using Linker.Application.Common.Exceptions;
using Linker.Application.Services;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class SavedInternshipServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly SavedInternshipService _service;

    public SavedInternshipServiceTests()
    {
        var context = _db.Context;
        _service = new SavedInternshipService(
            new SavedInternshipRepository(context),
            new StudentRepository(context),
            new InternshipRepository(context),
            context);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Save_ThenGet_ReturnsTheInternship()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());

        await _service.SaveAsync(student.UserId, internship.Id);
        var saved = await _service.GetSavedAsync(student.UserId);

        Assert.Equal(internship.Id, Assert.Single(saved).Id);
    }

    [Fact]
    public async Task Save_IsIdempotent()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());

        await _service.SaveAsync(student.UserId, internship.Id);
        await _service.SaveAsync(student.UserId, internship.Id);

        Assert.Single(await _service.GetSavedAsync(student.UserId));
    }

    [Fact]
    public async Task Save_UnknownInternship_IsNotFound()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<NotFoundException>(() => _service.SaveAsync(student.UserId, 9999));
    }

    [Fact]
    public async Task Unsave_RemovesIt()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());
        await _service.SaveAsync(student.UserId, internship.Id);

        await _service.UnsaveAsync(student.UserId, internship.Id);

        Assert.Empty(await _service.GetSavedAsync(student.UserId));
    }

    [Fact]
    public async Task Unsave_WhenNotSaved_IsANoOp()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());

        await _service.UnsaveAsync(student.UserId, internship.Id);

        Assert.Empty(await _service.GetSavedAsync(student.UserId));
    }

    [Fact]
    public async Task GetSaved_IsPerStudent()
    {
        var mine = _db.AddStudent();
        var theirs = _db.AddStudent("other@test.local");
        var internship = _db.AddInternship(_db.AddCompany());
        await _service.SaveAsync(theirs.UserId, internship.Id);

        Assert.Empty(await _service.GetSavedAsync(mine.UserId));
    }

    [Fact]
    public async Task GetSaved_MarksResultsAsSaved()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());
        await _service.SaveAsync(student.UserId, internship.Id);

        var saved = await _service.GetSavedAsync(student.UserId);

        Assert.True(Assert.Single(saved).IsSaved);
    }

    [Fact]
    public async Task GetSaved_ReportsSkillMatchAgainstTheStudentsSkills()
    {
        var student = _db.AddStudent();
        var angular = _db.AddSkill("Angular");
        var csharp = _db.AddSkill("C#");
        _db.GiveStudentSkills(student, angular.Id);
        var internship = _db.AddInternship(
            _db.AddCompany(), requiredSkillIds: [angular.Id, csharp.Id]);
        await _service.SaveAsync(student.UserId, internship.Id);

        var item = Assert.Single(await _service.GetSavedAsync(student.UserId));

        Assert.Equal(1, item.MatchedSkillCount);
        Assert.Equal(2, item.RequiredSkillCount);
    }

    [Fact]
    public async Task Save_ForANonStudent_IsNotFound()
    {
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.SaveAsync(company.UserId, internship.Id));
    }
}
