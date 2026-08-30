using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Admin;

public record AdminUserResponse(
    int Id,
    string Email,
    string Role,
    bool IsActive,
    bool EmailVerified,
    DateTime CreatedAtUtc);

public record AdminInternshipResponse(
    int Id,
    string Title,
    string CompanyName,
    bool IsActive,
    DateTime CreatedAtUtc);

public record AdminStatsResponse(
    int TotalUsers,
    int Students,
    int Companies,
    int TotalInternships,
    int ActiveInternships);

public record SetUserActiveRequest([Required] bool IsActive);

/// <summary>A company as the moderation queue sees it, newest sign-ups first.</summary>
public record AdminCompanyResponse(
    int Id,
    string Name,
    string Email,
    string? Website,
    bool IsVerified,
    bool EmailVerified,
    bool IsActive,
    int ListingCount,
    DateTime CreatedAtUtc);

public record SetCompanyVerifiedRequest([Required] bool IsVerified);

public record CreateSkillRequest(
    [Required, MaxLength(100)] string Name,
    [MaxLength(100)] string? Category = null);
