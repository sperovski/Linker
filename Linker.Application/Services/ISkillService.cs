using Linker.Application.DTOs.Skills;
using Linker.Application.DTOs.Students;

namespace Linker.Application.Services;

public interface ISkillService
{
    Task<IReadOnlyList<SkillResponse>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> AssignToStudentAsync(int userId, AssignSkillRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> RemoveFromStudentAsync(int userId, int skillId, CancellationToken cancellationToken = default);
}
