using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Companies;
using Linker.Application.Mappings;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class CompanyService : ICompanyService
{
    private readonly ICompanyRepository _companyRepository;
    private readonly IInternshipRepository _internshipRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CompanyService(
        ICompanyRepository companyRepository,
        IInternshipRepository internshipRepository,
        IApplicationRepository applicationRepository,
        IUnitOfWork unitOfWork)
    {
        _companyRepository = companyRepository;
        _internshipRepository = internshipRepository;
        _applicationRepository = applicationRepository;
        _unitOfWork = unitOfWork;
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

        _companyRepository.Update(company);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return company.ToResponse();
    }

    public async Task<CompanyDashboardResponse> GetDashboardAsync(int userId, CancellationToken cancellationToken = default)
    {
        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No company profile exists for user '{userId}'.");

        var internships = await _internshipRepository.GetByCompanyAsync(company.Id, cancellationToken);
        var applications = await _applicationRepository.GetByCompanyAsync(company.Id, cancellationToken);

        var applicationsByInternship = applications
            .GroupBy(a => a.InternshipId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var listings = internships
            .Select(i =>
            {
                applicationsByInternship.TryGetValue(i.Id, out var apps);
                apps ??= [];
                return new DashboardListingResponse(
                    i.Id,
                    i.Title,
                    i.IsActive,
                    i.ApplicationDeadline,
                    apps.Count,
                    apps.Count(a => a.Status is ApplicationStatus.Submitted or ApplicationStatus.UnderReview));
            })
            .ToList();

        var recent = applications
            .Take(8)
            .Select(a => new DashboardApplicantResponse(
                a.Id,
                $"{a.Student.FirstName} {a.Student.LastName}",
                a.InternshipId,
                a.Internship.Title,
                a.Status.ToString(),
                a.CreatedAt))
            .ToList();

        return new CompanyDashboardResponse(
            internships.Count,
            internships.Count(i => i.IsActive),
            applications.Count,
            // "Pending" here means awaiting a decision: newly submitted or under review.
            applications.Count(a => a.Status is ApplicationStatus.Submitted or ApplicationStatus.UnderReview),
            applications.Count(a => a.Status == ApplicationStatus.Accepted),
            listings,
            recent);
    }
}
