using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Applications;

public record CreateApplicationRequest(
    [Range(1, int.MaxValue)] int InternshipId,
    [MaxLength(4000)] string? CoverLetter);

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
    string? CoverLetter,
    DateTime AppliedAtUtc);
