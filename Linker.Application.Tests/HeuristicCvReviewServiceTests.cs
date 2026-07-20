using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Cv;
using Linker.Application.Services;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class HeuristicCvReviewServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly HeuristicCvReviewService _service;

    public HeuristicCvReviewServiceTests()
    {
        var context = _db.Context;
        _service = new HeuristicCvReviewService(new SkillRepository(context), new InternshipRepository(context));
    }

    public void Dispose() => _db.Dispose();

    /// <summary>A CV with enough signals to clear the CV-ness gate.</summary>
    private const string RealCv = """
        Stefan Perovski — stefan@example.com — +389 70 123 456

        Education
        FINKI, Ss. Cyril and Methodius University. BSc Computer Science, expected 2026.

        Experience
        Software Engineering Intern at Acme. Built an Angular dashboard and
        developed a reporting service. Reduced page load time by 40%.

        Projects
        Linker — an internship platform. Designed the API and implemented matching.

        Skills
        Angular, C#, SQL
        """;

    [Fact]
    public async Task Review_OnNonCvText_IsRejected()
    {
        var text = "The weather in Skopje was pleasant today and we walked by the river for an hour.";

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.ReviewAsync(1, new CvReviewRequest(text, null)));
    }

    [Fact]
    public async Task Review_OnEmptyText_IsRejected()
    {
        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.ReviewAsync(1, new CvReviewRequest("", null)));
    }

    [Fact]
    public async Task Review_OnARealCv_ScoresAndReportsHeuristicSource()
    {
        var response = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, null));

        Assert.InRange(response.Score, 5, 99);
        Assert.Equal("heuristic", response.Source);
        Assert.NotEmpty(response.Strengths);
        Assert.NotEmpty(response.Improvements);
    }

    [Fact]
    public async Task Review_WithoutATargetRole_HasNoRoleFit()
    {
        var response = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, null));

        Assert.Null(response.TargetRole);
        Assert.Null(response.RoleFit);
    }

    [Fact]
    public async Task Review_DetectsKnownSkillsMentionedInTheCv()
    {
        _db.AddSkill("Angular");
        _db.AddSkill("C#");
        _db.AddSkill("Kubernetes");

        var response = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, null));

        Assert.Contains("Angular", response.MatchedSkills);
        Assert.Contains("C#", response.MatchedSkills);
        Assert.DoesNotContain("Kubernetes", response.MatchedSkills);
    }

    [Fact]
    public async Task Review_AgainstARole_SplitsMatchedAndMissingSkills()
    {
        var angular = _db.AddSkill("Angular");
        var kubernetes = _db.AddSkill("Kubernetes");
        var internship = _db.AddInternship(
            _db.AddCompany(), title: "Frontend Intern", requiredSkillIds: [angular.Id, kubernetes.Id]);

        var response = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, internship.Id));

        Assert.Equal("Frontend Intern", response.TargetRole);
        Assert.Contains("Angular", response.MatchedSkills);
        Assert.Contains("Kubernetes", response.MissingSkills);
    }

    [Fact]
    public async Task Review_ScoresAFullSkillMatchAboveNoMatch()
    {
        var angular = _db.AddSkill("Angular");
        var kubernetes = _db.AddSkill("Kubernetes");
        var company = _db.AddCompany();
        var goodFit = _db.AddInternship(company, title: "Frontend Intern", requiredSkillIds: [angular.Id]);
        var badFit = _db.AddInternship(company, title: "Platform Intern", requiredSkillIds: [kubernetes.Id]);

        var good = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, goodFit.Id));
        var bad = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, badFit.Id));

        Assert.True(good.RoleFit > bad.RoleFit);
        Assert.True(good.Score > bad.Score);
    }

    [Fact]
    public async Task Review_AgainstAnUnknownInternship_FallsBackToAGeneralReview()
    {
        var response = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, 9999));

        Assert.Null(response.TargetRole);
        Assert.Null(response.RoleFit);
    }

    [Fact]
    public async Task Review_SuggestsQuantifyingWhenTheCvHasNoNumbers()
    {
        var noNumbers = """
            Education: studied Computer Science at the faculty.
            Experience: worked as an intern at a company.
            Projects: built a portfolio site and developed a small tool.
            Skills: teamwork
            """;

        var response = await _service.ReviewAsync(1, new CvReviewRequest(noNumbers, null));

        Assert.Contains(response.Improvements, i => i.Contains("Quantify", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Review_CreditsQuantifiedImpact()
    {
        var response = await _service.ReviewAsync(1, new CvReviewRequest(RealCv, null));

        Assert.Contains(response.Strengths, s => s.Contains("numbers", StringComparison.OrdinalIgnoreCase));
    }
}
