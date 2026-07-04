using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Internships;

public record CreateInternshipRequest(
    [Required, MaxLength(200)] string Title,
    [Required, MaxLength(8000)] string Description,
    [MaxLength(200)] string? Location,
    [Required] string Type,
    DateOnly? StartDate,
    DateOnly? EndDate);

public record UpdateInternshipRequest(
    [Required, MaxLength(200)] string Title,
    [Required, MaxLength(8000)] string Description,
    [MaxLength(200)] string? Location,
    [Required] string Type,
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
