using Linker.Application.DTOs.Admin;
using Linker.Application.DTOs.Skills;

namespace Linker.Application.Services;

public interface IAdminService
{
    Task<AdminStatsResponse> GetStatsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminUserResponse>> ListUsersAsync(CancellationToken cancellationToken = default);
    Task SetUserActiveAsync(int actingUserId, int userId, bool isActive, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminInternshipResponse>> ListInternshipsAsync(CancellationToken cancellationToken = default);
    Task CloseInternshipAsync(int internshipId, CancellationToken cancellationToken = default);
    Task<SkillResponse> CreateSkillAsync(CreateSkillRequest request, CancellationToken cancellationToken = default);
}
