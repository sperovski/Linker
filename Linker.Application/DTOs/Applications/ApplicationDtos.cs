using System.ComponentModel.DataAnnotations;
using Linker.Application.DTOs.Skills;

namespace Linker.Application.DTOs.Applications;

public record CreateApplicationRequest(
    [Range(1, int.MaxValue)] int InternshipId,
    [MaxLength(1000)] string? CoverNote);

public record UpdateApplicationStatusRequest(
    [Required] string Status);

public record ApplicationResponse(
    int Id,
    int StudentId,
    string StudentName,
    int InternshipId,
    string InternshipTitle,
    string CompanyName,
    string Status,
    string? CoverNote,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>
/// An application as the reviewing company sees it: the applicant's profile is
/// embedded so the applicants page needs one request, not one per applicant.
/// </summary>
public record ApplicantResponse(
    int Id,
    int StudentId,
    string StudentName,
    string? University,
    int? GraduationYear,
    string? Bio,
    IReadOnlyList<SkillResponse> Skills,
    string Status,
    string? CoverNote,
    DateTime CreatedAt,
    DateTime UpdatedAt);
