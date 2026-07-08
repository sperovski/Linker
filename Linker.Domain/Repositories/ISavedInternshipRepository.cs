using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface ISavedInternshipRepository : IRepository<SavedInternship>
{
    Task<IReadOnlyList<SavedInternship>> GetByStudentAsync(int studentId, CancellationToken cancellationToken = default);
    Task<SavedInternship?> GetAsync(int studentId, int internshipId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<int>> GetSavedInternshipIdsAsync(int studentId, CancellationToken cancellationToken = default);
}
