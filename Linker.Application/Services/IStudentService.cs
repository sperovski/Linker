using Linker.Application.Common.Interfaces;
using Linker.Application.DTOs.Students;

namespace Linker.Application.Services;

public interface IStudentService
{
    Task<StudentProfileResponse> GetByIdAsync(int studentId, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> UpdateProfileAsync(int userId, UpdateStudentProfileRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> UploadCvAsync(int userId, string fileName, byte[] content, CancellationToken cancellationToken = default);
    Task<CvFileContent> GetCvFileAsync(int requesterUserId, int studentId, CancellationToken cancellationToken = default);

    // Profile sections. Every mutation returns the refreshed full profile so
    // the client never has to stitch state together locally.
    Task<StudentProfileResponse> AddExperienceAsync(int userId, SaveExperienceRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> UpdateExperienceAsync(int userId, int experienceId, SaveExperienceRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> DeleteExperienceAsync(int userId, int experienceId, CancellationToken cancellationToken = default);

    Task<StudentProfileResponse> AddEducationAsync(int userId, SaveEducationRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> UpdateEducationAsync(int userId, int educationId, SaveEducationRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> DeleteEducationAsync(int userId, int educationId, CancellationToken cancellationToken = default);

    Task<StudentProfileResponse> AddProjectAsync(int userId, SaveProjectRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> UpdateProjectAsync(int userId, int projectId, SaveProjectRequest request, CancellationToken cancellationToken = default);
    Task<StudentProfileResponse> DeleteProjectAsync(int userId, int projectId, CancellationToken cancellationToken = default);
}
