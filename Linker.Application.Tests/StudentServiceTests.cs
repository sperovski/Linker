using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Applications;
using Linker.Application.DTOs.Students;
using Linker.Application.Services;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class StudentServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly FakeCvFileStorage _storage = new();
    private readonly FakeCvTextExtractor _extractor = new();
    private readonly StudentService _service;
    private readonly ApplicationService _applications;

    public StudentServiceTests()
    {
        var context = _db.Context;
        _service = new StudentService(
            new StudentRepository(context),
            new ExperienceRepository(context),
            new EducationRepository(context),
            new ProjectRepository(context),
            new CompanyRepository(context),
            new ApplicationRepository(context),
            new SkillRepository(context),
            _storage,
            _extractor,
            context);

        _applications = new ApplicationService(
            new ApplicationRepository(context),
            new InternshipRepository(context),
            new StudentRepository(context),
            new CompanyRepository(context),
            new NoOpNotificationService(),
            context);
    }

    public void Dispose() => _db.Dispose();

    private static SaveExperienceRequest Experience(
        DateOnly? start = null,
        DateOnly? end = null) =>
        new("Intern", "Acme", "Skopje", start ?? new DateOnly(2025, 1, 1), end, "Did things.");

    // ---- CV upload -------------------------------------------------------

    [Theory]
    [InlineData("cv.pdf")]
    [InlineData("cv.PDF")]
    [InlineData("cv.doc")]
    [InlineData("cv.docx")]
    public async Task UploadCv_AcceptsAllowedExtensions(string fileName)
    {
        var student = _db.AddStudent();

        var result = await _service.UploadCvAsync(student.UserId, fileName, [1, 2, 3]);

        Assert.NotNull(result.Profile.CvUrl);
    }

    [Theory]
    [InlineData("cv.exe")]
    [InlineData("cv.txt")]
    [InlineData("cv")]
    public async Task UploadCv_RejectsOtherExtensions(string fileName)
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.UploadCvAsync(student.UserId, fileName, [1]));
    }

    [Fact]
    public async Task UploadCv_ReplacingAnUpload_DeletesTheOldFile()
    {
        var student = _db.AddStudent();
        var first = await _service.UploadCvAsync(student.UserId, "old.pdf", [1]);

        await _service.UploadCvAsync(student.UserId, "new.pdf", [2]);

        Assert.Equal([first.Profile.CvUrl], _storage.Deleted);
    }

    [Fact]
    public async Task UploadCv_OverAnExternalLink_LeavesTheLinkAlone()
    {
        var student = _db.AddStudent();
        student.CvUrl = "https://example.com/my-cv.pdf";
        _db.Save();

        await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        // An external link isn't ours to delete.
        Assert.Empty(_storage.Deleted);
    }

    // ---- CV import -------------------------------------------------------

    private const string SampleCv = """
        Stefan Perovski
        BSc Computer Science at Faculty of Computer Science and Engineering.
        Worked at Acme as an intern building things with Angular and C#.
        """;

    [Fact]
    public async Task UploadCv_AddsCatalogueSkillsFoundInTheCv()
    {
        var student = _db.AddStudent();
        _db.AddSkill("Angular");
        _db.AddSkill("C#");
        _db.AddSkill("Kubernetes");
        _extractor.Text = SampleCv;

        var result = await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        Assert.Equal(["Angular", "C#"], result.AddedSkills.Order());
        Assert.Equal(2, result.Profile.Skills.Count);
    }

    [Fact]
    public async Task UploadCv_DoesNotDuplicateSkillsTheStudentAlreadyHas()
    {
        var student = _db.AddStudent();
        var angular = _db.AddSkill("Angular");
        _db.AddSkill("C#");
        _db.GiveStudentSkills(student, angular.Id);
        _extractor.Text = SampleCv;

        var result = await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        Assert.Equal(["C#"], result.AddedSkills);
        Assert.Equal(2, result.Profile.Skills.Count);
    }

    [Fact]
    public async Task UploadCv_WritesABioWhenTheStudentHasNone()
    {
        var student = _db.AddStudent();
        _db.AddSkill("Angular");
        _extractor.Text = SampleCv;

        var result = await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        Assert.True(result.BioApplied);
        Assert.Null(result.SuggestedBio);
        Assert.False(string.IsNullOrWhiteSpace(result.Profile.Bio));
    }

    [Fact]
    public async Task UploadCv_NeverOverwritesAnExistingBio()
    {
        var student = _db.AddStudent();
        student.Bio = "My own carefully written bio.";
        _db.Save();
        _db.AddSkill("Angular");
        _extractor.Text = SampleCv;

        var result = await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        Assert.False(result.BioApplied);
        Assert.Equal("My own carefully written bio.", result.Profile.Bio);
        // Offered back instead, for the student to accept or ignore.
        Assert.False(string.IsNullOrWhiteSpace(result.SuggestedBio));
    }

    [Fact]
    public async Task UploadCv_WithUnreadableFile_StillUploadsAndImportsNothing()
    {
        var student = _db.AddStudent();
        _db.AddSkill("Angular");
        // A scanned, image-only PDF: the extractor throws.
        _extractor.Text = null;

        var result = await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        Assert.False(result.TextExtracted);
        Assert.NotNull(result.Profile.CvUrl);
        Assert.Empty(result.AddedSkills);
        Assert.False(result.BioApplied);
    }

    [Fact]
    public async Task UploadCv_WithNoMatchingSkills_ImportsNone()
    {
        var student = _db.AddStudent();
        _db.AddSkill("Kubernetes");
        _extractor.Text = SampleCv;

        var result = await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        Assert.Empty(result.AddedSkills);
        Assert.True(result.TextExtracted);
    }

    [Fact]
    public async Task UploadCv_ImportedSkillsSurviveAReload()
    {
        var student = _db.AddStudent();
        _db.AddSkill("Angular");
        _extractor.Text = SampleCv;

        await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);

        var reloaded = await _service.GetByUserIdAsync(student.UserId);
        Assert.Equal("Angular", Assert.Single(reloaded.Skills).Name);
    }

    // ---- CV access control ----------------------------------------------

    [Fact]
    public async Task GetCvFile_LetsTheOwningStudentRead()
    {
        var student = _db.AddStudent();
        await _service.UploadCvAsync(student.UserId, "cv.pdf", [7]);

        var file = await _service.GetCvFileAsync(student.UserId, student.Id);

        Assert.Equal([7], file.Content);
    }

    [Fact]
    public async Task GetCvFile_DeniesAnUnrelatedStudent()
    {
        var owner = _db.AddStudent();
        var other = _db.AddStudent("other@test.local");
        await _service.UploadCvAsync(owner.UserId, "cv.pdf", [1]);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.GetCvFileAsync(other.UserId, owner.Id));
    }

    [Fact]
    public async Task GetCvFile_LetsACompanyTheStudentAppliedToRead()
    {
        var student = _db.AddStudent();
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company);
        await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);
        await _applications.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));

        var file = await _service.GetCvFileAsync(company.UserId, student.Id);

        Assert.Equal([1], file.Content);
    }

    [Fact]
    public async Task GetCvFile_DeniesACompanyTheStudentNeverAppliedTo()
    {
        var student = _db.AddStudent();
        var applied = _db.AddCompany();
        var stranger = _db.AddCompany("stranger@test.local", "Stranger Co");
        await _service.UploadCvAsync(student.UserId, "cv.pdf", [1]);
        await _applications.ApplyAsync(
            student.UserId,
            new CreateApplicationRequest(_db.AddInternship(applied).Id, null));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.GetCvFileAsync(stranger.UserId, student.Id));
    }

    [Fact]
    public async Task GetCvFile_WithoutAnUpload_IsNotFound()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetCvFileAsync(student.UserId, student.Id));
    }

    [Fact]
    public async Task GetCvFile_ForAnExternalLink_IsNotFound()
    {
        var student = _db.AddStudent();
        student.CvUrl = "https://example.com/my-cv.pdf";
        _db.Save();

        // Not ours to stream, even for the owner.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetCvFileAsync(student.UserId, student.Id));
    }

    // ---- Profile sections ------------------------------------------------

    [Fact]
    public async Task AddExperience_AppearsOnTheProfile()
    {
        var student = _db.AddStudent();

        var profile = await _service.AddExperienceAsync(student.UserId, Experience());

        var entry = Assert.Single(profile.Experiences);
        Assert.Equal("Intern", entry.Title);
    }

    [Fact]
    public async Task AddExperience_WithEndBeforeStart_IsRejected()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.AddExperienceAsync(
                student.UserId,
                Experience(new DateOnly(2025, 6, 1), new DateOnly(2025, 1, 1))));
    }

    [Fact]
    public async Task AddExperience_WithoutAnEndDate_IsAllowed()
    {
        var student = _db.AddStudent();

        var profile = await _service.AddExperienceAsync(student.UserId, Experience());

        Assert.Null(Assert.Single(profile.Experiences).EndDate);
    }

    [Fact]
    public async Task UpdateExperience_BelongingToAnotherStudent_IsForbidden()
    {
        var owner = _db.AddStudent();
        var intruder = _db.AddStudent("intruder@test.local");
        var owned = await _service.AddExperienceAsync(owner.UserId, Experience());
        var experienceId = owned.Experiences[0].Id;

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.UpdateExperienceAsync(intruder.UserId, experienceId, Experience()));
    }

    [Fact]
    public async Task DeleteExperience_BelongingToAnotherStudent_IsForbidden()
    {
        var owner = _db.AddStudent();
        var intruder = _db.AddStudent("intruder@test.local");
        var owned = await _service.AddExperienceAsync(owner.UserId, Experience());

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.DeleteExperienceAsync(intruder.UserId, owned.Experiences[0].Id));
    }

    [Fact]
    public async Task DeleteExperience_RemovesItFromTheProfile()
    {
        var student = _db.AddStudent();
        var added = await _service.AddExperienceAsync(student.UserId, Experience());

        var profile = await _service.DeleteExperienceAsync(student.UserId, added.Experiences[0].Id);

        Assert.Empty(profile.Experiences);
    }

    [Fact]
    public async Task AddEducation_WithEndBeforeStart_IsRejected()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.AddEducationAsync(
                student.UserId,
                new SaveEducationRequest(
                    "FINKI", "BSc", "CS", new DateOnly(2025, 6, 1), new DateOnly(2024, 1, 1))));
    }

    [Fact]
    public async Task UpdateProject_BelongingToAnotherStudent_IsForbidden()
    {
        var owner = _db.AddStudent();
        var intruder = _db.AddStudent("intruder@test.local");
        var request = new SaveProjectRequest("Linker", "A platform", "https://x.dev", "Angular");
        var owned = await _service.AddProjectAsync(owner.UserId, request);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.UpdateProjectAsync(intruder.UserId, owned.Projects[0].Id, request));
    }

    // ---- Profile ---------------------------------------------------------

    [Fact]
    public async Task UpdateProfile_PersistsTheChanges()
    {
        var student = _db.AddStudent();

        var profile = await _service.UpdateProfileAsync(student.UserId, new UpdateStudentProfileRequest(
            "Stefan", "P", "FINKI", 2026, "Bio", "Headline",
            null, null, null, null, null));

        Assert.Equal("Stefan", profile.FirstName);
        Assert.Equal("FINKI", profile.University);
        Assert.Equal(2026, profile.GraduationYear);
    }

    [Fact]
    public async Task GetByUserId_ForANonStudent_IsNotFound()
    {
        var company = _db.AddCompany();

        await Assert.ThrowsAsync<NotFoundException>(() => _service.GetByUserIdAsync(company.UserId));
    }
}
