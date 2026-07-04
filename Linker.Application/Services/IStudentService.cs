using Linker.Application.DTOs.Students;

namespace Linker.Application.Services;

public interface IStudentService
{
    Task<StudentProfileResponse> GetByIdAsync(int studentId, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> UpdateProfileAsync(int userId, UpdateStudentProfileRequest request, CancellationToken cancellationToken = default);
}
