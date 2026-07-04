using Linker.Application.DTOs.Companies;

namespace Linker.Application.Services;

public interface ICompanyService
{
    Task<CompanyProfileResponse> GetByIdAsync(int companyId, CancellationToken cancellationToken = default);
    Task<CompanyProfileResponse> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default);
    Task<CompanyProfileResponse> UpdateProfileAsync(int userId, UpdateCompanyProfileRequest request, CancellationToken cancellationToken = default);
}
