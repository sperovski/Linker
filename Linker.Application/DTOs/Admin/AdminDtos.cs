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

public record CreateSkillRequest([Required, MaxLength(100)] string Name);
