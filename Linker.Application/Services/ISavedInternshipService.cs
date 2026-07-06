using Linker.Application.DTOs.Internships;

namespace Linker.Application.Services;

public interface ISavedInternshipService
{
    Task<IReadOnlyList<InternshipListItemResponse>> GetSavedAsync(int userId, CancellationToken cancellationToken = default);
    Task SaveAsync(int userId, int internshipId, CancellationToken cancellationToken = default);
    Task UnsaveAsync(int userId, int internshipId, CancellationToken cancellationToken = default);
}
