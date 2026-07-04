using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface IApplicationRepository : IRepository<Application>
{
    Task<IReadOnlyList<Application>> GetByStudentAsync(int studentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Application>> GetByInternshipAsync(int internshipId, CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(int studentId, int internshipId, CancellationToken cancellationToken = default);
}
