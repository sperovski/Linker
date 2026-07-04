using Linker.Application.DTOs.Skills;

namespace Linker.Application.DTOs.Students;

public record StudentProfileResponse(
    int Id,
    int UserId,
    string FirstName,
    string LastName,
    string? University,
    int? GraduationYear,
    string? Bio,
    IReadOnlyList<SkillResponse> Skills);

public record UpdateStudentProfileRequest(
    string FirstName,
    string LastName,
    string? University,
    int? GraduationYear,
    string? Bio);
