using Linker.Application.DTOs.Applications;

namespace Linker.Application.Services;

public interface IApplicationService
{
    Task<ApplicationResponse> ApplyAsync(int userId, CreateApplicationRequest request, CancellationToken cancellationToken = default);
    Task<ApplicationResponse> UpdateStatusAsync(int userId, int applicationId, UpdateApplicationStatusRequest request, CancellationToken cancellationToken = default);
    Task<ApplicationResponse> GetByIdAsync(int userId, int applicationId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ApplicationResponse>> GetOwnApplicationsAsync(int userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ApplicationResponse>> GetByInternshipAsync(int userId, int internshipId, CancellationToken cancellationToken = default);
}
