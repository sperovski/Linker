using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Companies;

public record CompanyProfileResponse(
    int Id,
    int UserId,
    string Name,
    string? Description,
    string? Website,
    bool IsVerified);

public record UpdateCompanyProfileRequest(
    [Required, MaxLength(200)] string Name,
    [MaxLength(4000)] string? Description,
    [MaxLength(500), Url] string? Website);

public record CompanyDashboardResponse(
    int TotalListings,
    int ActiveListings,
    int TotalApplicants,
    int PendingApplicants,
    int AcceptedApplicants,
    IReadOnlyList<DashboardListingResponse> Listings,
    IReadOnlyList<DashboardApplicantResponse> RecentApplicants);

public record DashboardListingResponse(
    int Id,
    string Title,
    bool IsActive,
    DateOnly? ApplicationDeadline,
    int ApplicantCount,
    int PendingCount);

public record DashboardApplicantResponse(
    int ApplicationId,
    string StudentName,
    int InternshipId,
    string InternshipTitle,
    string Status,
    DateTime CreatedAt);
