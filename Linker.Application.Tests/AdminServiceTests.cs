using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Admin;
using Linker.Application.Services;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class AdminServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly AdminService _service;

    public AdminServiceTests()
    {
        var context = _db.Context;
        _service = new AdminService(
            new UserRepository(context),
            new InternshipRepository(context),
            new SkillRepository(context),
            context);
    }

    public void Dispose() => _db.Dispose();

    private User AddAdmin(string email = "admin@test.local")
    {
        var admin = new User
        {
            Email = email,
            PasswordHash = "hash",
            Role = UserRole.Admin,
            CreatedAtUtc = DateTime.UtcNow
        };
        _db.Context.Users.Add(admin);
        _db.Save();
        return admin;
    }

    // ---- Stats -----------------------------------------------------------

    [Fact]
    public async Task GetStats_CountsUsersByRoleAndActiveInternships()
    {
        var company = _db.AddCompany();
        _db.AddStudent();
        _db.AddStudent("second@test.local");
        _db.AddInternship(company);
        _db.AddInternship(company, isActive: false);

        var stats = await _service.GetStatsAsync();

        Assert.Equal(3, stats.TotalUsers);
        Assert.Equal(2, stats.Students);
        Assert.Equal(1, stats.Companies);
        Assert.Equal(2, stats.TotalInternships);
        Assert.Equal(1, stats.ActiveInternships);
    }

    // ---- Account status --------------------------------------------------

    [Fact]
    public async Task SetUserActive_DisablesAStudent()
    {
        var admin = AddAdmin();
        var student = _db.AddStudent();

        await _service.SetUserActiveAsync(admin.Id, student.UserId, false);

        Assert.False(_db.NewContext().Users.Single(u => u.Id == student.UserId).IsActive);
    }

    [Fact]
    public async Task SetUserActive_ReEnablesADisabledUser()
    {
        var admin = AddAdmin();
        var student = _db.AddStudent();
        await _service.SetUserActiveAsync(admin.Id, student.UserId, false);

        await _service.SetUserActiveAsync(admin.Id, student.UserId, true);

        Assert.True(_db.NewContext().Users.Single(u => u.Id == student.UserId).IsActive);
    }

    [Fact]
    public async Task SetUserActive_OnYourself_IsRejected()
    {
        var admin = AddAdmin();

        // Guards against an admin locking themselves out.
        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.SetUserActiveAsync(admin.Id, admin.Id, false));
    }

    [Fact]
    public async Task SetUserActive_OnAnotherAdmin_IsRejected()
    {
        var admin = AddAdmin();
        var peer = AddAdmin("peer@test.local");

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.SetUserActiveAsync(admin.Id, peer.Id, false));
    }

    [Fact]
    public async Task SetUserActive_OnAnUnknownUser_IsNotFound()
    {
        var admin = AddAdmin();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.SetUserActiveAsync(admin.Id, 9999, false));
    }

    // ---- Listings --------------------------------------------------------

    [Fact]
    public async Task ListUsers_PagesResults()
    {
        _db.AddCompany();
        for (var i = 0; i < 4; i++)
        {
            _db.AddStudent($"student{i}@test.local");
        }

        var page = await _service.ListUsersAsync(page: 1, pageSize: 2);

        Assert.Equal(2, page.Items.Count);
        Assert.Equal(5, page.Total);
    }

    [Fact]
    public async Task ListUsers_NormalizesNonsensePagingArguments()
    {
        _db.AddStudent();

        var page = await _service.ListUsersAsync(page: 0, pageSize: -5);

        Assert.Single(page.Items);
        Assert.True(page.Page >= 1);
        Assert.True(page.PageSize >= 1);
    }

    [Fact]
    public async Task CloseInternship_DeactivatesWithoutDeleting()
    {
        var internship = _db.AddInternship(_db.AddCompany());

        await _service.CloseInternshipAsync(internship.Id);

        var stored = _db.NewContext().Internships.Single(i => i.Id == internship.Id);
        Assert.False(stored.IsActive);
    }

    [Fact]
    public async Task CloseInternship_UnknownId_IsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => _service.CloseInternshipAsync(9999));
    }

    // ---- Skills ----------------------------------------------------------

    [Fact]
    public async Task CreateSkill_TrimsAndDefaultsTheCategory()
    {
        var skill = await _service.CreateSkillAsync(new CreateSkillRequest("  Rust  "));

        Assert.Equal("Rust", skill.Name);
        Assert.Equal("Other", skill.Category);
    }

    [Fact]
    public async Task CreateSkill_KeepsAGivenCategory()
    {
        var skill = await _service.CreateSkillAsync(new CreateSkillRequest("Rust", "  Languages  "));

        Assert.Equal("Languages", skill.Category);
    }

    [Fact]
    public async Task CreateSkill_DuplicateName_ThrowsConflict()
    {
        await _service.CreateSkillAsync(new CreateSkillRequest("Rust"));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CreateSkillAsync(new CreateSkillRequest("Rust")));
    }

    [Fact]
    public async Task CreateSkill_DuplicateAfterTrimming_ThrowsConflict()
    {
        await _service.CreateSkillAsync(new CreateSkillRequest("Rust"));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CreateSkillAsync(new CreateSkillRequest("  Rust  ")));
    }
}
