using Linker.Application.DTOs.Admin;
using Linker.Application.DTOs.Common;
using Linker.Application.DTOs.Skills;

namespace Linker.Application.Services;

public interface IAdminService
{
    Task<AdminStatsResponse> GetStatsAsync(CancellationToken cancellationToken = default);
    Task<PagedResponse<AdminUserResponse>> ListUsersAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task SetUserActiveAsync(int actingUserId, int userId, bool isActive, CancellationToken cancellationToken = default);
    Task<PagedResponse<AdminInternshipResponse>> ListInternshipsAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task CloseInternshipAsync(int internshipId, CancellationToken cancellationToken = default);
    Task<SkillResponse> CreateSkillAsync(CreateSkillRequest request, CancellationToken cancellationToken = default);
}
