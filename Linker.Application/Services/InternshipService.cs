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
    private readonly IStudentRepository _studentRepository;
    private readonly ISkillRepository _skillRepository;
    private readonly ISavedInternshipRepository _savedInternshipRepository;
    private readonly IApplicationRepository _applicationRepository;

    public InternshipService(
        IInternshipRepository internshipRepository,
        ICompanyRepository companyRepository,
        IStudentRepository studentRepository,
        ISkillRepository skillRepository,
        ISavedInternshipRepository savedInternshipRepository,
        IApplicationRepository applicationRepository)
    {
        _internshipRepository = internshipRepository;
        _companyRepository = companyRepository;
        _studentRepository = studentRepository;
        _skillRepository = skillRepository;
        _savedInternshipRepository = savedInternshipRepository;
        _applicationRepository = applicationRepository;
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
            ApplicationDeadline = request.ApplicationDeadline,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        foreach (var skillId in await ValidatedSkillIdsAsync(request.SkillIds, cancellationToken))
        {
            internship.RequiredSkills.Add(new InternshipSkill { SkillId = skillId });
        }

        await _internshipRepository.AddAsync(internship, cancellationToken);

        internship.Company = company;
        return (await _internshipRepository.GetWithDetailsAsync(internship.Id, cancellationToken))!.ToDetailResponse();
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
        internship.ApplicationDeadline = request.ApplicationDeadline;

        var desiredSkillIds = await ValidatedSkillIdsAsync(request.SkillIds, cancellationToken);
        var currentSkillIds = internship.RequiredSkills.Select(rs => rs.SkillId).ToHashSet();

        foreach (var removed in internship.RequiredSkills.Where(rs => !desiredSkillIds.Contains(rs.SkillId)).ToList())
        {
            internship.RequiredSkills.Remove(removed);
        }

        foreach (var added in desiredSkillIds.Where(id => !currentSkillIds.Contains(id)))
        {
            internship.RequiredSkills.Add(new InternshipSkill { InternshipId = internship.Id, SkillId = added });
        }

        await _internshipRepository.UpdateAsync(internship, cancellationToken);

        return (await _internshipRepository.GetWithDetailsAsync(internship.Id, cancellationToken))!.ToDetailResponse();
    }

    public async Task<InternshipDetailResponse> CloseAsync(int userId, int internshipId, CancellationToken cancellationToken = default)
    {
        var internship = await GetOwnedInternshipAsync(userId, internshipId, cancellationToken);

        internship.IsActive = false;
        await _internshipRepository.UpdateAsync(internship, cancellationToken);

        return internship.ToDetailResponse();
    }

    public async Task<IReadOnlyList<InternshipListItemResponse>> SearchAsync(InternshipSearchRequest request, int? userId = null, CancellationToken cancellationToken = default)
    {
        // Public search only ever exposes open listings; closed ones are visible
        // to their owning company via GetOwnListingsAsync.
        var type = string.IsNullOrWhiteSpace(request.Type) ? (InternshipType?)null : ParseType(request.Type);
        var internships = await _internshipRepository.SearchActiveAsync(request.Location, request.SearchText, type, cancellationToken);

        var (skillIds, savedIds) = await LoadStudentContextAsync(userId, cancellationToken);

        return internships
            .Select(i => i.ToListItemResponse(skillIds, savedIds))
            // Best matches first when we have a student to match against; the
            // repository's recency ordering is preserved within an equal score.
            .OrderByDescending(i => i.MatchScore ?? -1)
            .ToList();
    }

    public async Task<IReadOnlyList<InternshipListItemResponse>> GetRecommendedAsync(int userId, int take, CancellationToken cancellationToken = default)
    {
        var (skillIds, savedIds) = await LoadStudentContextAsync(userId, cancellationToken);
        if (skillIds is null)
        {
            // Recommendations are skill-driven; nothing to offer without a student.
            return [];
        }

        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken);
        var applied = (await _applicationRepository.GetByStudentAsync(student!.Id, cancellationToken))
            .Select(a => a.InternshipId)
            .ToHashSet();

        var active = await _internshipRepository.SearchActiveAsync(null, null, null, cancellationToken);

        return active
            .Where(i => !applied.Contains(i.Id))
            .Select(i => i.ToListItemResponse(skillIds, savedIds))
            .Where(r => r.MatchScore is > 0)
            .OrderByDescending(r => r.MatchScore)
            .Take(take)
            .ToList();
    }

    public async Task<IReadOnlyList<InternshipListItemResponse>> GetPopularAsync(int take, int? userId = null, CancellationToken cancellationToken = default)
    {
        var (skillIds, savedIds) = await LoadStudentContextAsync(userId, cancellationToken);
        var popular = await _internshipRepository.GetPopularActiveAsync(take, cancellationToken);

        // Repository already ordered by application count; preserve that order.
        return popular.Select(i => i.ToListItemResponse(skillIds, savedIds)).ToList();
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

    public async Task<InternshipDetailResponse> GetDetailAsync(int internshipId, int? userId = null, CancellationToken cancellationToken = default)
    {
        var internship = await _internshipRepository.GetWithDetailsAsync(internshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", internshipId);

        var (skillIds, savedIds) = await LoadStudentContextAsync(userId, cancellationToken);

        return internship.ToDetailResponse(skillIds, savedIds);
    }

    // Resolves the calling user, when present, into the two sets the response
    // mappers need: the student's own skill ids (for match scoring) and the ids
    // of internships they have saved (for the bookmark flag). Both are null for
    // anonymous callers and for companies, which suppresses those fields.
    private async Task<(IReadOnlySet<int>? SkillIds, IReadOnlySet<int>? SavedIds)> LoadStudentContextAsync(int? userId, CancellationToken cancellationToken)
    {
        if (userId is null)
        {
            return (null, null);
        }

        var student = await _studentRepository.GetByUserIdAsync(userId.Value, cancellationToken);
        if (student is null)
        {
            return (null, null);
        }

        var withSkills = await _studentRepository.GetWithSkillsAsync(student.Id, cancellationToken);
        var skillIds = withSkills!.Skills.Select(ss => ss.SkillId).ToHashSet();
        var savedIds = (await _savedInternshipRepository.GetSavedInternshipIdsAsync(student.Id, cancellationToken)).ToHashSet();

        return (skillIds, savedIds);
    }

    private async Task<IReadOnlyList<int>> ValidatedSkillIdsAsync(IReadOnlyList<int>? skillIds, CancellationToken cancellationToken)
    {
        if (skillIds is null || skillIds.Count == 0)
        {
            return [];
        }

        var distinct = skillIds.Distinct().ToList();
        var known = (await _skillRepository.GetAllAsync(cancellationToken)).Select(s => s.Id).ToHashSet();
        var unknown = distinct.Where(id => !known.Contains(id)).ToList();
        if (unknown.Count > 0)
        {
            throw new ConflictException($"Unknown skill id(s): {string.Join(", ", unknown)}.");
        }

        return distinct;
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
