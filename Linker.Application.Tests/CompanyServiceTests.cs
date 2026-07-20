using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Applications;
using Linker.Application.DTOs.Companies;
using Linker.Application.Services;
using Linker.Domain.Enums;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class CompanyServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly CompanyService _service;
    private readonly ApplicationService _applications;

    public CompanyServiceTests()
    {
        var context = _db.Context;
        _service = new CompanyService(
            new CompanyRepository(context),
            new InternshipRepository(context),
            new ApplicationRepository(context),
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

    // ---- Profile ---------------------------------------------------------

    [Fact]
    public async Task UpdateProfile_PersistsTheChanges()
    {
        var company = _db.AddCompany();

        var profile = await _service.UpdateProfileAsync(
            company.UserId,
            new UpdateCompanyProfileRequest("Renamed Co", "We build things.", "https://renamed.mk"));

        Assert.Equal("Renamed Co", profile.Name);
        Assert.Equal("We build things.", profile.Description);
        Assert.Equal("https://renamed.mk", profile.Website);
    }

    [Fact]
    public async Task GetByUserId_ForANonCompany_IsNotFound()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<NotFoundException>(() => _service.GetByUserIdAsync(student.UserId));
    }

    [Fact]
    public async Task GetById_UnknownCompany_IsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => _service.GetByIdAsync(9999));
    }

    // ---- Dashboard -------------------------------------------------------

    [Fact]
    public async Task Dashboard_OnAFreshAccount_IsAllZeroes()
    {
        var company = _db.AddCompany();

        var dashboard = await _service.GetDashboardAsync(company.UserId);

        Assert.Equal(0, dashboard.TotalListings);
        Assert.Equal(0, dashboard.TotalApplicants);
        Assert.Empty(dashboard.Listings);
        Assert.Empty(dashboard.RecentApplicants);
    }

    [Fact]
    public async Task Dashboard_CountsActiveAndClosedListings()
    {
        var company = _db.AddCompany();
        _db.AddInternship(company);
        _db.AddInternship(company, isActive: false);

        var dashboard = await _service.GetDashboardAsync(company.UserId);

        Assert.Equal(2, dashboard.TotalListings);
        Assert.Equal(1, dashboard.ActiveListings);
    }

    [Fact]
    public async Task Dashboard_CountsPendingSeparatelyFromDecided()
    {
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company);
        var submitted = _db.AddStudent("a@test.local");
        var accepted = _db.AddStudent("b@test.local");
        var rejected = _db.AddStudent("c@test.local");

        await _applications.ApplyAsync(submitted.UserId, new CreateApplicationRequest(internship.Id, null));
        var toAccept = await _applications.ApplyAsync(accepted.UserId, new CreateApplicationRequest(internship.Id, null));
        var toReject = await _applications.ApplyAsync(rejected.UserId, new CreateApplicationRequest(internship.Id, null));
        await _applications.UpdateStatusAsync(
            company.UserId, toAccept.Id, new UpdateApplicationStatusRequest(ApplicationStatus.Accepted.ToString()));
        await _applications.UpdateStatusAsync(
            company.UserId, toReject.Id, new UpdateApplicationStatusRequest(ApplicationStatus.Rejected.ToString()));

        var dashboard = await _service.GetDashboardAsync(company.UserId);

        Assert.Equal(3, dashboard.TotalApplicants);
        Assert.Equal(1, dashboard.PendingApplicants);
        Assert.Equal(1, dashboard.AcceptedApplicants);
    }

    [Fact]
    public async Task Dashboard_ReportsPerListingApplicationCounts()
    {
        var company = _db.AddCompany();
        var busy = _db.AddInternship(company, title: "Busy role");
        _db.AddInternship(company, title: "Quiet role");
        var student = _db.AddStudent();
        await _applications.ApplyAsync(student.UserId, new CreateApplicationRequest(busy.Id, null));

        var dashboard = await _service.GetDashboardAsync(company.UserId);

        var busyListing = dashboard.Listings.Single(l => l.Title == "Busy role");
        var quietListing = dashboard.Listings.Single(l => l.Title == "Quiet role");
        Assert.Equal(1, busyListing.ApplicantCount);
        Assert.Equal(1, busyListing.PendingCount);
        Assert.Equal(0, quietListing.ApplicantCount);
    }

    [Fact]
    public async Task Dashboard_ExcludesOtherCompaniesData()
    {
        var mine = _db.AddCompany();
        var theirs = _db.AddCompany("other@test.local", "Other Co");
        _db.AddInternship(theirs);
        var student = _db.AddStudent();
        await _applications.ApplyAsync(
            student.UserId, new CreateApplicationRequest(_db.AddInternship(theirs).Id, null));

        var dashboard = await _service.GetDashboardAsync(mine.UserId);

        Assert.Equal(0, dashboard.TotalListings);
        Assert.Equal(0, dashboard.TotalApplicants);
    }

    [Fact]
    public async Task Dashboard_CapsRecentApplicantsAtEight()
    {
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company);
        for (var i = 0; i < 10; i++)
        {
            var student = _db.AddStudent($"student{i}@test.local");
            await _applications.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));
        }

        var dashboard = await _service.GetDashboardAsync(company.UserId);

        Assert.Equal(10, dashboard.TotalApplicants);
        Assert.Equal(8, dashboard.RecentApplicants.Count);
    }

    [Fact]
    public async Task Dashboard_NamesTheRecentApplicants()
    {
        var company = _db.AddCompany();
        var internship = _db.AddInternship(company, title: "Backend intern");
        var student = _db.AddStudent();
        await _applications.ApplyAsync(student.UserId, new CreateApplicationRequest(internship.Id, null));

        var dashboard = await _service.GetDashboardAsync(company.UserId);

        var applicant = Assert.Single(dashboard.RecentApplicants);
        Assert.Equal("Test Student", applicant.StudentName);
        Assert.Equal("Backend intern", applicant.InternshipTitle);
    }
}
