using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Linker.Domain.Entities;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Linker.Api.IntegrationTests;

/// <summary>
/// Paged search against real Postgres. The unit suite runs on SQLite and cannot
/// prove that ILike or the match-score ordering subquery translate to SQL — if
/// either silently fell back to client evaluation, paging would return wrong rows.
/// </summary>
public class SearchPagingTests : IClassFixture<LinkerApiFactory>
{
    private readonly LinkerApiFactory _factory;

    public SearchPagingTests(LinkerApiFactory factory) => _factory = factory;

    private record AuthBody(int userId, string email, string role, string token, string refreshToken);
    private record ListItem(int id, string title, string companyName, int? matchScore);
    private record Facet(string name, int count);
    private record SearchBody(List<ListItem> items, int total, int page, int pageSize, List<Facet> companies);

    private async Task<(HttpClient Client, string CompanyName)> CreateCompanyWithListingsAsync(int count, string titlePrefix)
    {
        var client = _factory.CreateClient();
        var companyName = $"Co-{Guid.NewGuid():N}"[..12];

        var register = await client.PostAsJsonAsync("/api/auth/register/company", new
        {
            email = $"co-{Guid.NewGuid():N}@test.local",
            password = "password123",
            name = companyName,
            description = (string?)null,
            website = (string?)null,
        });
        register.EnsureSuccessStatusCode();
        var body = await register.Content.ReadFromJsonAsync<AuthBody>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.token);

        for (var i = 0; i < count; i++)
        {
            var created = await client.PostAsJsonAsync("/api/internships", new
            {
                title = $"{titlePrefix} {i}",
                description = "Integration test listing.",
                location = "Skopje",
                type = "Internship",
                startDate = (string?)null,
                endDate = (string?)null,
                applicationDeadline = (string?)null,
                skillIds = Array.Empty<int>(),
            });
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        }

        return (client, companyName);
    }

    [Fact]
    public async Task Search_PagesAreDisjoint_AndTotalCountsWholeResultSet()
    {
        var marker = $"Pager{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(5, marker);

        var anon = _factory.CreateClient();

        var first = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&page=1&pageSize=2");
        var second = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&page=2&pageSize=2");
        var third = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&page=3&pageSize=2");

        // ILike ran in SQL: only this test's listings came back.
        Assert.Equal(5, first!.total);
        Assert.Equal(2, first.items.Count);
        Assert.Equal(2, second!.items.Count);
        Assert.Single(third!.items);

        var ids = first.items.Concat(second.items).Concat(third.items).Select(i => i.id).ToList();
        Assert.Equal(5, ids.Distinct().Count());
    }

    [Fact]
    public async Task Search_OversizedPageSize_IsClamped()
    {
        var marker = $"Clamp{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(1, marker);

        var anon = _factory.CreateClient();
        var body = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&pageSize=999");

        Assert.InRange(body!.pageSize, 1, 50);
        Assert.Equal(1, body.page);
    }

    [Fact]
    public async Task Search_AsStudent_TranslatesMatchScoreOrdering()
    {
        var marker = $"Score{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(3, marker);

        var student = _factory.CreateClient();
        var register = await student.PostAsJsonAsync("/api/auth/register/student", new
        {
            email = $"st-{Guid.NewGuid():N}@test.local",
            password = "password123",
            firstName = "Test",
            lastName = "Student",
        });
        var body = await register.Content.ReadFromJsonAsync<AuthBody>();
        student.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.token);

        // A student — even one with no skills — takes the scoring branch, so this
        // request fails outright if the ordering subquery can't be translated.
        var response = await student.GetAsync($"/api/internships?searchText={marker}&pageSize=2");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var page = await response.Content.ReadFromJsonAsync<SearchBody>();
        Assert.Equal(3, page!.total);
        Assert.Equal(2, page.items.Count);
    }

    [Fact]
    public async Task Search_CompanyFacet_CountsOpenRoles()
    {
        var marker = $"Facet{Guid.NewGuid():N}"[..14];
        var (_, companyName) = await CreateCompanyWithListingsAsync(3, marker);

        var anon = _factory.CreateClient();
        var body = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}");

        var facet = Assert.Single(body!.companies, c => c.name == companyName);
        Assert.Equal(3, facet.count);
    }

    private record ApplicantBody(int id, string studentName, string? university, int? graduationYear, string? bio, List<SkillBody> skills, string status);
    private record SkillBody(int id, string name);
    private record ApplicantsPage(List<ApplicantBody> items, int total, int page, int pageSize);

    [Fact]
    public async Task Applicants_EmbedProfile_SoThePageNeedsNoPerApplicantRequest()
    {
        var marker = $"Embed{Guid.NewGuid():N}"[..14];
        var (company, _) = await CreateCompanyWithListingsAsync(1, marker);

        var anon = _factory.CreateClient();
        var listing = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}");
        var internshipId = listing!.items[0].id;

        // A student with a filled-in profile and one skill.
        var student = _factory.CreateClient();
        var email = $"st-{Guid.NewGuid():N}@test.local";
        var register = await student.PostAsJsonAsync("/api/auth/register/student", new
        {
            email,
            password = "password123",
            firstName = "Ada",
            lastName = "Lovelace",
        });
        var auth = await register.Content.ReadFromJsonAsync<AuthBody>();
        student.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.token);

        var profile = await student.PutAsJsonAsync("/api/students/me", new
        {
            firstName = "Ada",
            lastName = "Lovelace",
            university = "FINKI",
            graduationYear = 2027,
            bio = "Likes analytical engines.",
        });
        profile.EnsureSuccessStatusCode();

        var skillName = await GiveStudentASkillAsync(auth.userId);

        var applied = await student.PostAsJsonAsync("/api/applications", new { internshipId, coverNote = "Hire me" });
        Assert.Equal(HttpStatusCode.Created, applied.StatusCode);

        var page = await company.GetFromJsonAsync<ApplicantsPage>($"/api/internships/{internshipId}/applications");

        var applicant = Assert.Single(page!.items);
        Assert.Equal("Ada Lovelace", applicant.studentName);
        Assert.Equal("FINKI", applicant.university);
        Assert.Equal(2027, applicant.graduationYear);
        Assert.Equal("Likes analytical engines.", applicant.bio);
        // The Include for student skills is easy to drop; without it this list is
        // silently empty and the applicants page loses its skill tags.
        Assert.Equal([skillName], applicant.skills.Select(s => s.name));
    }

    /// <summary>Attaches one freshly created skill to the student behind <paramref name="userId"/>.</summary>
    private async Task<string> GiveStudentASkillAsync(int userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LinkerDbContext>();

        var name = $"Skill-{Guid.NewGuid():N}"[..14];
        var skill = new Skill { Name = name };
        db.Skills.Add(skill);
        await db.SaveChangesAsync();

        var student = await db.Students.SingleAsync(s => s.UserId == userId);
        db.StudentSkills.Add(new StudentSkill { StudentId = student.Id, SkillId = skill.Id });
        await db.SaveChangesAsync();

        return name;
    }

    [Fact]
    public async Task Recommended_TranslatesToSql_AndDropsAppliedListings()
    {
        var marker = $"Rec{Guid.NewGuid():N}"[..12];
        var (company, _) = await CreateCompanyWithListingsAsync(0, marker);

        var student = _factory.CreateClient();
        var register = await student.PostAsJsonAsync("/api/auth/register/student", new
        {
            email = $"rec-{Guid.NewGuid():N}@test.local",
            password = "password123",
            firstName = "Rec",
            lastName = "Student",
        });
        var auth = await register.Content.ReadFromJsonAsync<AuthBody>();
        student.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.token);

        var skillId = await GiveStudentASkillIdAsync(auth.userId);

        // A listing requiring exactly the student's skill.
        var created = await company.PostAsJsonAsync("/api/internships", new
        {
            title = $"{marker} match",
            description = "Needs the student's skill.",
            location = "Skopje",
            type = "Internship",
            startDate = (string?)null,
            endDate = (string?)null,
            applicationDeadline = (string?)null,
            skillIds = new[] { skillId },
        });
        created.EnsureSuccessStatusCode();
        var listing = await created.Content.ReadFromJsonAsync<ListItem>();

        // The whole match/exclude/order pipeline runs in SQL — a translation
        // failure here throws rather than silently client-evaluating.
        var before = await student.GetFromJsonAsync<List<ListItem>>("/api/internships/recommended?take=10");
        Assert.Contains(before!, i => i.id == listing!.id);
        Assert.Equal(100, before!.Single(i => i.id == listing!.id).matchScore);

        var applied = await student.PostAsJsonAsync("/api/applications", new { internshipId = listing!.id, coverNote = (string?)null });
        Assert.Equal(HttpStatusCode.Created, applied.StatusCode);

        var after = await student.GetFromJsonAsync<List<ListItem>>("/api/internships/recommended?take=10");
        Assert.DoesNotContain(after!, i => i.id == listing.id);
    }

    private async Task<int> GiveStudentASkillIdAsync(int userId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LinkerDbContext>();

        var skill = new Skill { Name = $"Sk-{Guid.NewGuid():N}"[..12] };
        db.Skills.Add(skill);
        await db.SaveChangesAsync();

        var student = await db.Students.SingleAsync(s => s.UserId == userId);
        db.StudentSkills.Add(new StudentSkill { StudentId = student.Id, SkillId = skill.Id });
        await db.SaveChangesAsync();

        return skill.Id;
    }

    [Fact]
    public async Task Applicants_ForNonOwningCompany_StillForbidden()
    {
        var marker = $"Owner{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(1, marker);

        var anon = _factory.CreateClient();
        var listing = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}");
        var internshipId = listing!.items[0].id;

        // A different company must not read the applicant list, paged or not.
        var (intruder, _) = await CreateCompanyWithListingsAsync(0, "unused");
        var response = await intruder.GetAsync($"/api/internships/{internshipId}/applications?page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
