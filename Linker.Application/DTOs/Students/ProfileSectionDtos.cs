using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Students;

// ---- Experience ----

public record ExperienceResponse(
    int Id,
    string Title,
    string Company,
    string? Location,
    DateOnly StartDate,
    DateOnly? EndDate,
    string? Description);

public record SaveExperienceRequest(
    [Required, MaxLength(150)] string Title,
    [Required, MaxLength(150)] string Company,
    [MaxLength(150)] string? Location,
    [Required] DateOnly StartDate,
    DateOnly? EndDate,
    [MaxLength(2000)] string? Description);

// ---- Education ----

public record EducationResponse(
    int Id,
    string Institution,
    string? Degree,
    string? FieldOfStudy,
    DateOnly StartDate,
    DateOnly? EndDate);

public record SaveEducationRequest(
    [Required, MaxLength(200)] string Institution,
    [MaxLength(150)] string? Degree,
    [MaxLength(150)] string? FieldOfStudy,
    [Required] DateOnly StartDate,
    DateOnly? EndDate);

// ---- Project ----

public record ProjectResponse(
    int Id,
    string Title,
    string? Description,
    string? Url,
    string? TechStack);

public record SaveProjectRequest(
    [Required, MaxLength(150)] string Title,
    [MaxLength(2000)] string? Description,
    [MaxLength(500), Url] string? Url,
    [MaxLength(500)] string? TechStack);
