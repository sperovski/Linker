namespace Linker.Application.DTOs.Companies;

public record CompanyProfileResponse(
    int Id,
    int UserId,
    string Name,
    string? Description,
    string? Website);

public record UpdateCompanyProfileRequest(
    string Name,
    string? Description,
    string? Website);
