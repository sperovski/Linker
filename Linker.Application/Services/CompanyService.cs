using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Companies;
using Linker.Application.Mappings;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class CompanyService : ICompanyService
{
    private readonly ICompanyRepository _companyRepository;

    public CompanyService(ICompanyRepository companyRepository)
    {
        _companyRepository = companyRepository;
    }

    public async Task<CompanyProfileResponse> GetByIdAsync(int companyId, CancellationToken cancellationToken = default)
    {
        var company = await _companyRepository.GetByIdAsync(companyId, cancellationToken)
            ?? throw new NotFoundException("Company", companyId);

        return company.ToResponse();
    }

    public async Task<CompanyProfileResponse> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default)
    {
        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No company profile exists for user '{userId}'.");

        return company.ToResponse();
    }

    public async Task<CompanyProfileResponse> UpdateProfileAsync(int userId, UpdateCompanyProfileRequest request, CancellationToken cancellationToken = default)
    {
        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No company profile exists for user '{userId}'.");

        company.Name = request.Name;
        company.Description = request.Description;
        company.Website = request.Website;

        await _companyRepository.UpdateAsync(company, cancellationToken);

        return company.ToResponse();
    }
}
