namespace Linker.Application.DTOs.Applications;

public record CreateApplicationRequest(int InternshipId, string? CoverLetter);

public record UpdateApplicationStatusRequest(string Status);

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
