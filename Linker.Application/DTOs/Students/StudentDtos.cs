using System.ComponentModel.DataAnnotations;
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
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [MaxLength(200)] string? University,
    [Range(1950, 2100)] int? GraduationYear,
    [MaxLength(2000)] string? Bio);
