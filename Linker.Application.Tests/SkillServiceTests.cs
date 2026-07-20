using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Skills;
using Linker.Application.Services;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class SkillServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly SkillService _service;

    public SkillServiceTests()
    {
        var context = _db.Context;
        _service = new SkillService(new SkillRepository(context), new StudentRepository(context), context);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task GetAll_ReturnsTheCatalogue()
    {
        _db.AddSkill("Angular");
        _db.AddSkill("C#");

        var skills = await _service.GetAllAsync();

        Assert.Equal(2, skills.Count);
    }

    [Fact]
    public async Task Assign_AddsTheSkillToTheProfile()
    {
        var student = _db.AddStudent();
        var skill = _db.AddSkill("Angular");

        var profile = await _service.AssignToStudentAsync(student.UserId, new AssignSkillRequest(skill.Id));

        Assert.Equal("Angular", Assert.Single(profile.Skills).Name);
    }

    [Fact]
    public async Task Assign_Twice_ThrowsConflict()
    {
        var student = _db.AddStudent();
        var skill = _db.AddSkill("Angular");
        await _service.AssignToStudentAsync(student.UserId, new AssignSkillRequest(skill.Id));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.AssignToStudentAsync(student.UserId, new AssignSkillRequest(skill.Id)));
    }

    [Fact]
    public async Task Assign_UnknownSkill_IsNotFound()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.AssignToStudentAsync(student.UserId, new AssignSkillRequest(9999)));
    }

    [Fact]
    public async Task Remove_TakesItOffTheProfile()
    {
        var student = _db.AddStudent();
        var skill = _db.AddSkill("Angular");
        await _service.AssignToStudentAsync(student.UserId, new AssignSkillRequest(skill.Id));

        var profile = await _service.RemoveFromStudentAsync(student.UserId, skill.Id);

        Assert.Empty(profile.Skills);
    }

    [Fact]
    public async Task Remove_ASkillTheStudentDoesNotHave_IsNotFound()
    {
        var student = _db.AddStudent();
        var skill = _db.AddSkill("Angular");

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.RemoveFromStudentAsync(student.UserId, skill.Id));
    }

    [Fact]
    public async Task Remove_LeavesTheSkillInTheCatalogue()
    {
        var student = _db.AddStudent();
        var skill = _db.AddSkill("Angular");
        await _service.AssignToStudentAsync(student.UserId, new AssignSkillRequest(skill.Id));

        await _service.RemoveFromStudentAsync(student.UserId, skill.Id);

        Assert.Single(await _service.GetAllAsync());
    }

    [Fact]
    public async Task Assign_ForANonStudent_IsNotFound()
    {
        var company = _db.AddCompany();
        var skill = _db.AddSkill("Angular");

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.AssignToStudentAsync(company.UserId, new AssignSkillRequest(skill.Id)));
    }
}
