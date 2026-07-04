using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Internships;
using Linker.Application.Mappings;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class InternshipService : IInternshipService
{
    private readonly IInternshipRepository _internshipRepository;
    private readonly ICompanyRepository _companyRepository;

    public InternshipService(IInternshipRepository internshipRepository, ICompanyRepository companyRepository)
    {
        _internshipRepository = internshipRepository;
        _companyRepository = companyRepository;
    }

    public async Task<InternshipDetailResponse> CreateAsync(int userId, CreateInternshipRequest request, CancellationToken cancellationToken = default)
    {
        var company = await GetCompanyAsync(userId, cancellationToken);

        var internship = new Internship
        {
            CompanyId = company.Id,
            Title = request.Title,
            Description = request.Description,
            Location = request.Location,
            Type = ParseType(request.Type),
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        await _internshipRepository.AddAsync(internship, cancellationToken);

        internship.Company = company;
        return internship.ToDetailResponse();
    }

    public async Task<InternshipDetailResponse> UpdateAsync(int userId, int internshipId, UpdateInternshipRequest request, CancellationToken cancellationToken = default)
    {
        var internship = await GetOwnedInternshipAsync(userId, internshipId, cancellationToken);

        internship.Title = request.Title;
        internship.Description = request.Description;
        internship.Location = request.Location;
        internship.Type = ParseType(request.Type);
        internship.StartDate = request.StartDate;
        internship.EndDate = request.EndDate;

        await _internshipRepository.UpdateAsync(internship, cancellationToken);

        return internship.ToDetailResponse();
    }

    public async Task<InternshipDetailResponse> CloseAsync(int userId, int internshipId, CancellationToken cancellationToken = default)
    {
        var internship = await GetOwnedInternshipAsync(userId, internshipId, cancellationToken);

        internship.IsActive = false;
        await _internshipRepository.UpdateAsync(internship, cancellationToken);

        return internship.ToDetailResponse();
    }

    public async Task<IReadOnlyList<InternshipListItemResponse>> SearchAsync(InternshipSearchRequest request, CancellationToken cancellationToken = default)
    {
        // Public search only ever exposes open listings; closed ones are visible
        // to their owning company via GetOwnListingsAsync.
        var type = string.IsNullOrWhiteSpace(request.Type) ? (InternshipType?)null : ParseType(request.Type);
        var internships = await _internshipRepository.SearchActiveAsync(request.Location, request.SearchText, type, cancellationToken);

        return internships.Select(i => i.ToListItemResponse()).ToList();
    }

    public async Task<IReadOnlyList<InternshipListItemResponse>> GetOwnListingsAsync(int userId, CancellationToken cancellationToken = default)
    {
        var company = await GetCompanyAsync(userId, cancellationToken);
        var internships = await _internshipRepository.GetByCompanyAsync(company.Id, cancellationToken);

        return internships
            .Select(i =>
            {
                i.Company = company;
                return i.ToListItemResponse();
            })
            .ToList();
    }

    public async Task<InternshipDetailResponse> GetDetailAsync(int internshipId, CancellationToken cancellationToken = default)
    {
        var internship = await _internshipRepository.GetWithCompanyAsync(internshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", internshipId);

        return internship.ToDetailResponse();
    }

    private static InternshipType ParseType(string type)
    {
        if (!Enum.TryParse<InternshipType>(type, ignoreCase: true, out var parsed))
        {
            var validValues = string.Join(", ", Enum.GetNames<InternshipType>());
            throw new ConflictException($"'{type}' is not a valid internship type. Valid values: {validValues}.");
        }

        return parsed;
    }

    private async Task<Company> GetCompanyAsync(int userId, CancellationToken cancellationToken)
    {
        return await _companyRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No company profile exists for user '{userId}'.");
    }

    private async Task<Internship> GetOwnedInternshipAsync(int userId, int internshipId, CancellationToken cancellationToken)
    {
        var internship = await _internshipRepository.GetWithCompanyAsync(internshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", internshipId);

        var company = await GetCompanyAsync(userId, cancellationToken);
        if (internship.CompanyId != company.Id)
        {
            throw new ForbiddenAccessException("Only the company that posted this internship can modify it.");
        }

        return internship;
    }
}
