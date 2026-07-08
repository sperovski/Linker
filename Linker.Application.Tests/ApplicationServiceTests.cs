using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Applications;
using Linker.Application.Services;
using Linker.Domain.Enums;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class ApplicationServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly ApplicationService _service;

    public ApplicationServiceTests()
    {
        var context = _db.Context;
        _service = new ApplicationService(
            new ApplicationRepository(context),
            new InternshipRepository(context),
            new StudentRepository(context),
            new CompanyRepository(context),
            new NoOpNotificationService(),
            context);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Apply_CreatesPendingApplication()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());

        var response = await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, "hello"));

        Assert.Equal("Pending", response.Status);
        Assert.Equal("hello", response.CoverLetter);
    }

    [Fact]
    public async Task Apply_Twice_ThrowsConflict()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());
        await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null)));
    }

    [Fact]
    public async Task Apply_AfterWithdraw_ReactivatesSameApplication()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany());
        var first = await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, "first"));
        await _service.WithdrawAsync(student.UserId, first.Id);

        var second = await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, "second"));

        Assert.Equal(first.Id, second.Id);
        Assert.Equal("Pending", second.Status);
        Assert.Equal("second", second.CoverLetter);
    }

    [Fact]
    public async Task Apply_ToClosedInternship_ThrowsConflict()
    {
        var student = _db.AddStudent();
        var internship = _db.AddInternship(_db.AddCompany(), isActive: false);

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null)));
    }

    [Fact]
    public async Task Apply_AfterDeadline_ThrowsConflict()
    {
        var student = _db.AddStudent();
        var pastDeadline = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);
        var internship = _db.AddInternship(_db.AddCompany(), deadline: pastDeadline);

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null)));
    }

    [Fact]
    public async Task Withdraw_RejectedApplication_ThrowsConflict()
    {
        var student = _db.AddStudent();
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company);
        var application = await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));
        await _service.UpdateStatusAsync(company.UserId, application.Id, new UpdateApplicationStatusRequest("Rejected"));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.WithdrawAsync(student.UserId, application.Id));
    }

    [Fact]
    public async Task Withdraw_SomeoneElsesApplication_ThrowsForbidden()
    {
        var applicant = _db.AddStudent("a@test.local");
        var other = _db.AddStudent("b@test.local");
        var internship = _db.AddInternship(_db.AddCompany());
        var application = await _service.ApplyAsync(applicant.UserId, new CreateApplicationRequest(internship.Id, null));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.WithdrawAsync(other.UserId, application.Id));
    }

    [Fact]
    public async Task UpdateStatus_ByNonOwningCompany_ThrowsForbidden()
    {
        var student = _db.AddStudent();
        var owner = _db.AddCompany("owner@test.local", "Owner Co");
        var intruder = _db.AddCompany("intruder@test.local", "Intruder Co");
        var internship = _db.AddInternship(owner);
        var application = await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.UpdateStatusAsync(intruder.UserId, application.Id, new UpdateApplicationStatusRequest("Accepted")));
    }

    [Fact]
    public async Task UpdateStatus_WithInvalidValue_ThrowsBadRequest()
    {
        var student = _db.AddStudent();
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company);
        var application = await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.UpdateStatusAsync(company.UserId, application.Id, new UpdateApplicationStatusRequest("Maybe")));
    }

    [Fact]
    public async Task UpdateStatus_ByOwner_Updates()
    {
        var student = _db.AddStudent();
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company);
        var application = await _service.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));

        var updated = await _service.UpdateStatusAsync(company.UserId, application.Id, new UpdateApplicationStatusRequest("Accepted"));

        Assert.Equal(nameof(ApplicationStatus.Accepted), updated.Status);
    }
}
