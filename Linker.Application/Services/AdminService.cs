using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Admin;
using Linker.Application.DTOs.Common;
using Linker.Application.DTOs.Skills;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class AdminService : IAdminService
{
    private readonly IUserRepository _userRepository;
    private readonly IInternshipRepository _internshipRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly ISkillRepository _skillRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AdminService(
        IUserRepository userRepository,
        IInternshipRepository internshipRepository,
        ICompanyRepository companyRepository,
        ISkillRepository skillRepository,
        IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _internshipRepository = internshipRepository;
        _companyRepository = companyRepository;
        _skillRepository = skillRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<AdminStatsResponse> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var (totalUsers, students, companies) = await _userRepository.CountByRoleAsync(cancellationToken);
        var (totalInternships, activeInternships) = await _internshipRepository.CountAsync(cancellationToken);

        return new AdminStatsResponse(totalUsers, students, companies, totalInternships, activeInternships);
    }

    public async Task<PagedResponse<AdminUserResponse>> ListUsersAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);
        var (users, total) = await _userRepository.ListPagedAsync(page, pageSize, cancellationToken);

        var items = users
            .Select(u => new AdminUserResponse(u.Id, u.Email, u.Role.ToString(), u.IsActive, u.EmailVerified, u.CreatedAtUtc))
            .ToList();

        return new PagedResponse<AdminUserResponse>(items, total, page, pageSize);
    }

    public async Task SetUserActiveAsync(int actingUserId, int userId, bool isActive, CancellationToken cancellationToken = default)
    {
        if (userId == actingUserId)
        {
            throw new BadRequestException("You cannot change your own account status.");
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);

        if (user.Role == UserRole.Admin)
        {
            throw new BadRequestException("Admin accounts cannot be disabled here.");
        }

        user.IsActive = isActive;
        _userRepository.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResponse<AdminInternshipResponse>> ListInternshipsAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);
        var (internships, total) = await _internshipRepository.ListPagedWithCompanyAsync(page, pageSize, cancellationToken);

        var items = internships
            .Select(i => new AdminInternshipResponse(i.Id, i.Title, i.Company.Name, i.IsActive, i.CreatedAtUtc))
            .ToList();

        return new PagedResponse<AdminInternshipResponse>(items, total, page, pageSize);
    }

    public async Task CloseInternshipAsync(int internshipId, CancellationToken cancellationToken = default)
    {
        var internship = await _internshipRepository.GetByIdAsync(internshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", internshipId);

        // Soft close (preserves applications/history) rather than a hard delete.
        internship.IsActive = false;
        _internshipRepository.Update(internship);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResponse<AdminCompanyResponse>> ListCompaniesAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Normalize(page, pageSize);
        var (companies, total) = await _companyRepository.ListPagedWithUserAsync(page, pageSize, cancellationToken);

        var items = companies
            .Select(c => new AdminCompanyResponse(
                c.Id,
                c.Name,
                c.User.Email,
                c.Website,
                c.IsVerified,
                c.User.EmailVerified,
                c.User.IsActive,
                c.Internships.Count,
                c.User.CreatedAtUtc))
            .ToList();

        return new PagedResponse<AdminCompanyResponse>(items, total, page, pageSize);
    }

    /// <summary>
    /// Grants or revokes the badge students see in chat. Deliberately admin-only
    /// and separate from the company's own profile update, so a company can never
    /// verify itself by editing its profile.
    /// </summary>
    public async Task SetCompanyVerifiedAsync(int companyId, bool isVerified, CancellationToken cancellationToken = default)
    {
        // With the user loaded: the email-verified precondition below reads the
        // account row, which a plain GetByIdAsync would leave null.
        var company = await _companyRepository.GetByIdWithUserAsync(companyId, cancellationToken)
            ?? throw new NotFoundException("Company", companyId);

        // A company with no confirmed email address hasn't proven anything yet;
        // badging it would put our word behind an unowned inbox.
        if (isVerified && !company.User.EmailVerified)
        {
            throw new BadRequestException("This company must confirm its email address before it can be verified.");
        }

        company.IsVerified = isVerified;
        company.VerifiedAtUtc = isVerified ? DateTime.UtcNow : null;
        _companyRepository.Update(company);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<SkillResponse> CreateSkillAsync(CreateSkillRequest request, CancellationToken cancellationToken = default)
    {
        var name = request.Name.Trim();
        if (await _skillRepository.GetByNameAsync(name, cancellationToken) is not null)
        {
            throw new ConflictException($"A skill named '{name}' already exists.");
        }

        var skill = new Skill
        {
            Name = name,
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Other" : request.Category.Trim(),
        };
        _skillRepository.Add(skill);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new SkillResponse(skill.Id, skill.Name, skill.Category);
    }
}
