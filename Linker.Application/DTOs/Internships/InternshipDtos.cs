namespace Linker.Application.DTOs.Internships;

public record CreateInternshipRequest(
    string Title,
    string Description,
    string? Location,
    string Type,
    DateOnly? StartDate,
    DateOnly? EndDate);

public record UpdateInternshipRequest(
    string Title,
    string Description,
    string? Location,
    string Type,
    DateOnly? StartDate,
    DateOnly? EndDate);

public record InternshipSearchRequest(string? Location, string? SearchText, string? Type);

public record InternshipListItemResponse(
    int Id,
    string Title,
    string? Location,
    string Type,
    string CompanyName,
    bool IsActive,
    DateOnly? StartDate,
    DateOnly? EndDate);

public record InternshipDetailResponse(
    int Id,
    int CompanyId,
    string CompanyName,
    string Title,
    string Description,
    string? Location,
    string Type,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsActive,
    DateTime CreatedAtUtc);
