using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Admin;
using Linker.Application.DTOs.Skills;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class AdminService : IAdminService
{
    private readonly IUserRepository _userRepository;
    private readonly IInternshipRepository _internshipRepository;
    private readonly ISkillRepository _skillRepository;
    private readonly IUnitOfWork _unitOfWork;

    public AdminService(
        IUserRepository userRepository,
        IInternshipRepository internshipRepository,
        ISkillRepository skillRepository,
        IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _internshipRepository = internshipRepository;
        _skillRepository = skillRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<AdminStatsResponse> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var users = await _userRepository.GetAllAsync(cancellationToken);
        var internships = await _internshipRepository.GetAllWithCompanyAsync(cancellationToken);

        return new AdminStatsResponse(
            users.Count,
            users.Count(u => u.Role == UserRole.Student),
            users.Count(u => u.Role == UserRole.Company),
            internships.Count,
            internships.Count(i => i.IsActive));
    }

    public async Task<IReadOnlyList<AdminUserResponse>> ListUsersAsync(CancellationToken cancellationToken = default)
    {
        var users = await _userRepository.GetAllAsync(cancellationToken);
        return users
            .OrderByDescending(u => u.CreatedAtUtc)
            .Select(u => new AdminUserResponse(u.Id, u.Email, u.Role.ToString(), u.IsActive, u.EmailVerified, u.CreatedAtUtc))
            .ToList();
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

    public async Task<IReadOnlyList<AdminInternshipResponse>> ListInternshipsAsync(CancellationToken cancellationToken = default)
    {
        var internships = await _internshipRepository.GetAllWithCompanyAsync(cancellationToken);
        return internships
            .Select(i => new AdminInternshipResponse(i.Id, i.Title, i.Company.Name, i.IsActive, i.CreatedAtUtc))
            .ToList();
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

    public async Task<SkillResponse> CreateSkillAsync(CreateSkillRequest request, CancellationToken cancellationToken = default)
    {
        var name = request.Name.Trim();
        if (await _skillRepository.GetByNameAsync(name, cancellationToken) is not null)
        {
            throw new ConflictException($"A skill named '{name}' already exists.");
        }

        var skill = new Skill { Name = name };
        _skillRepository.Add(skill);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new SkillResponse(skill.Id, skill.Name);
    }
}
