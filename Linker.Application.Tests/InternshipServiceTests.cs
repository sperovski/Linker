using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Internships;
using Linker.Application.Services;
using Linker.Domain.Entities;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

/// <summary>
/// Paging and match-score ordering for the public search. These run on SQLite, so
/// they deliberately avoid the location/searchText filters — those use ILike, which
/// is Npgsql-only and is covered in Linker.Api.IntegrationTests instead.
/// </summary>
public class InternshipServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly InternshipService _service;

    public InternshipServiceTests()
    {
        var context = _db.Context;
        _service = new InternshipService(
            new InternshipRepository(context),
            new CompanyRepository(context),
            new StudentRepository(context),
            new SkillRepository(context),
            new SavedInternshipRepository(context),
            new ApplicationRepository(context),
            context);
    }

    public void Dispose() => _db.Dispose();

    private static InternshipSearchRequest Search(int page = 1, int pageSize = 20, string? company = null) =>
        new(null, null, null, company, page, pageSize);

    /// <summary>A student whose skills are a known subset, plus internships of varying overlap.</summary>
    private (Student Student, Company Company) SeedMatchScenario()
    {
        var a = _db.AddSkill("A");
        var b = _db.AddSkill("B");
        var company = _db.AddCompany();
        var student = _db.AddStudent();
        _db.GiveStudentSkills(student, a.Id, b.Id);

        // 100%, 50%, and a listing with no required skills (null score, sorts last).
        _db.AddInternship(company, title: "full", requiredSkillIds: [a.Id, b.Id]);
        _db.AddInternship(company, title: "half", requiredSkillIds: [a.Id, _db.AddSkill("C").Id]);
        _db.AddInternship(company, title: "none");

        return (student, company);
    }

    [Fact]
    public async Task Search_OrdersByMatchScore_BestFirst()
    {
        var (student, _) = SeedMatchScenario();

        var result = await _service.SearchAsync(Search(), student.UserId);

        Assert.Equal(3, result.Total);
        Assert.Equal(["full", "half", "none"], result.Items.Select(i => i.Title));
        Assert.Equal(100, result.Items[0].MatchScore);
        Assert.Equal(50, result.Items[1].MatchScore);
        Assert.Null(result.Items[2].MatchScore);
    }

    [Fact]
    public async Task Search_PagesDoNotOverlap_AndStayGloballyOrdered()
    {
        var (student, _) = SeedMatchScenario();

        var first = await _service.SearchAsync(Search(page: 1, pageSize: 2), student.UserId);
        var second = await _service.SearchAsync(Search(page: 2, pageSize: 2), student.UserId);

        Assert.Equal(3, first.Total);
        Assert.Equal(2, first.Items.Count);
        Assert.Single(second.Items);

        // No row appears on both pages...
        Assert.Empty(first.Items.Select(i => i.Id).Intersect(second.Items.Select(i => i.Id)));

        // ...and the concatenation is still sorted best-match-first. This is the
        // assertion that fails if the sort ever moves back into memory.
        var scores = first.Items.Concat(second.Items).Select(i => i.MatchScore ?? -1).ToList();
        Assert.Equal(scores.OrderByDescending(s => s), scores);
    }

    [Fact]
    public async Task Search_ListingWithNoRequiredSkills_SortsBelowAnyMatch()
    {
        var (student, _) = SeedMatchScenario();

        var result = await _service.SearchAsync(Search(), student.UserId);

        Assert.Equal("none", result.Items.Last().Title);
    }

    [Fact]
    public async Task Search_Anonymous_HasNoScores_AndOrdersByRecency()
    {
        var company = _db.AddCompany();
        var now = DateTime.UtcNow;
        _db.AddInternship(company, title: "older", createdAtUtc: now.AddDays(-2));
        _db.AddInternship(company, title: "newer", createdAtUtc: now);

        var result = await _service.SearchAsync(Search());

        Assert.Equal(["newer", "older"], result.Items.Select(i => i.Title));
        Assert.All(result.Items, i => Assert.Null(i.MatchScore));
    }

    [Fact]
    public async Task Search_StudentWithNoSkills_ScoresZero_NotNull()
    {
        var skill = _db.AddSkill("A");
        var company = _db.AddCompany();
        var student = _db.AddStudent();
        _db.AddInternship(company, title: "wants-a", requiredSkillIds: skill.Id);

        var result = await _service.SearchAsync(Search(), student.UserId);

        // A student with an empty skill set is not the same as an anonymous caller.
        Assert.Equal(0, result.Items[0].MatchScore);
    }

    [Fact]
    public async Task Search_InactiveListings_AreExcluded()
    {
        var company = _db.AddCompany();
        _db.AddInternship(company, title: "open");
        _db.AddInternship(company, isActive: false, title: "closed");

        var result = await _service.SearchAsync(Search());

        Assert.Equal(1, result.Total);
        Assert.Equal("open", result.Items[0].Title);
    }

    [Theory]
    [InlineData(0, 20)]      // page < 1 coerces to 1
    [InlineData(-5, 20)]
    [InlineData(1, 0)]       // pageSize out of range falls back to the default
    [InlineData(1, 999)]
    public async Task Search_NormalizesOutOfRangePaging(int page, int pageSize)
    {
        var company = _db.AddCompany();
        _db.AddInternship(company);

        var result = await _service.SearchAsync(Search(page, pageSize));

        Assert.True(result.Page >= 1);
        Assert.InRange(result.PageSize, 1, 50);
        Assert.Single(result.Items);
    }

    [Fact]
    public async Task Search_CompanyFilter_NarrowsItems_ButFacetKeepsEveryCompany()
    {
        var acme = _db.AddCompany("acme@test.local", "Acme");
        var globex = _db.AddCompany("globex@test.local", "Globex");
        _db.AddInternship(acme);
        _db.AddInternship(acme);
        _db.AddInternship(globex);

        var result = await _service.SearchAsync(Search(company: "Acme"));

        Assert.Equal(2, result.Total);
        Assert.All(result.Items, i => Assert.Equal("Acme", i.CompanyName));

        // The facet ignores the company filter, so the dropdown still offers Globex.
        Assert.Equal(["Acme", "Globex"], result.Companies.Select(c => c.Name));
        Assert.Equal([2, 1], result.Companies.Select(c => c.Count));
    }

    [Fact]
    public async Task Recommended_RanksByMatch_AndSkipsZeroOverlap()
    {
        var (student, company) = SeedMatchScenario();
        _db.AddInternship(company, title: "unrelated", requiredSkillIds: _db.AddSkill("Z").Id);

        var result = await _service.GetRecommendedAsync(student.UserId, 10);

        // "none" has no required skills and "unrelated" shares none: neither is a match.
        Assert.Equal(["full", "half"], result.Select(i => i.Title));
    }

    [Fact]
    public async Task Recommended_ExcludesAlreadyAppliedListings()
    {
        var (student, company) = SeedMatchScenario();
        var applications = new ApplicationService(
            new ApplicationRepository(_db.Context),
            new InternshipRepository(_db.Context),
            new StudentRepository(_db.Context),
            new CompanyRepository(_db.Context),
            new NoOpNotificationService(),
            _db.Context);

        var full = (await _service.GetRecommendedAsync(student.UserId, 10)).First();
        await applications.ApplyAsync(student.UserId, new DTOs.Applications.CreateApplicationRequest(full.Id, null));

        var after = await _service.GetRecommendedAsync(student.UserId, 10);

        Assert.DoesNotContain(after, i => i.Id == full.Id);
    }

    [Fact]
    public async Task Recommended_WithdrawnApplication_IsStillExcluded()
    {
        var (student, _) = SeedMatchScenario();
        var applications = new ApplicationService(
            new ApplicationRepository(_db.Context),
            new InternshipRepository(_db.Context),
            new StudentRepository(_db.Context),
            new CompanyRepository(_db.Context),
            new NoOpNotificationService(),
            _db.Context);

        var full = (await _service.GetRecommendedAsync(student.UserId, 10)).First();
        var app = await applications.ApplyAsync(student.UserId, new DTOs.Applications.CreateApplicationRequest(full.Id, null));
        await applications.WithdrawAsync(student.UserId, app.Id);

        // Matches the pre-existing behaviour: any application row suppresses the suggestion.
        Assert.DoesNotContain(await _service.GetRecommendedAsync(student.UserId, 10), i => i.Id == full.Id);
    }

    [Fact]
    public async Task Recommended_RespectsTake()
    {
        var (student, _) = SeedMatchScenario();

        var result = await _service.GetRecommendedAsync(student.UserId, 1);

        Assert.Single(result);
        Assert.Equal("full", result[0].Title);
    }

    [Fact]
    public async Task Recommended_StudentWithNoSkills_ReturnsNothing()
    {
        var company = _db.AddCompany();
        var student = _db.AddStudent();
        _db.AddInternship(company, requiredSkillIds: _db.AddSkill("A").Id);

        Assert.Empty(await _service.GetRecommendedAsync(student.UserId, 10));
    }

    [Fact]
    public async Task Recommended_InactiveListing_IsNotSuggested()
    {
        var skill = _db.AddSkill("A");
        var company = _db.AddCompany();
        var student = _db.AddStudent();
        _db.GiveStudentSkills(student, skill.Id);
        _db.AddInternship(company, isActive: false, title: "closed", requiredSkillIds: skill.Id);

        Assert.Empty(await _service.GetRecommendedAsync(student.UserId, 10));
    }

    [Fact]
    public async Task Search_Facet_ReflectsOtherFilters()
    {
        var acme = _db.AddCompany("acme@test.local", "Acme");
        var globex = _db.AddCompany("globex@test.local", "Globex");
        _db.AddInternship(acme);
        _db.AddInternship(globex, isActive: false);

        var result = await _service.SearchAsync(Search());

        // Globex has no *open* roles, so it should not be offered as a filter.
        Assert.Equal(["Acme"], result.Companies.Select(c => c.Name));
    }
    // ---- Close / reopen ---------------------------------------------------

    [Fact]
    public async Task Reopen_PutsAClosedListingBackOnTheBoard()
    {
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company, isActive: false, deadline: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)));

        var result = await _service.ReopenAsync(company.UserId, internship.Id);

        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task Reopen_AListingWithNoDeadline_IsAllowed()
    {
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company, isActive: false);

        var result = await _service.ReopenAsync(company.UserId, internship.Id);

        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task Reopen_AListingWhoseDeadlineHasPassed_IsRejected()
    {
        var company = _db.AddCompany();
        var internship = _db.AddInternship(
            company, isActive: false, deadline: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)));

        // Otherwise it goes back on the board as a posting nobody can apply to.
        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.ReopenAsync(company.UserId, internship.Id));
    }

    [Fact]
    public async Task Reopen_AnotherCompanysListing_IsRefused()
    {
        var mine = _db.AddCompany();
        var theirs = _db.AddCompany("other@test.local", "Other Co");
        var internship = _db.AddInternship(theirs, isActive: false);

        await Assert.ThrowsAnyAsync<Exception>(() => _service.ReopenAsync(mine.UserId, internship.Id));
    }

}
