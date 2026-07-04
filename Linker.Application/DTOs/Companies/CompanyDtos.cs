using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Companies;

public record CompanyProfileResponse(
    int Id,
    int UserId,
    string Name,
    string? Description,
    string? Website);

public record UpdateCompanyProfileRequest(
    [Required, MaxLength(200)] string Name,
    [MaxLength(4000)] string? Description,
    [MaxLength(500), Url] string? Website);
