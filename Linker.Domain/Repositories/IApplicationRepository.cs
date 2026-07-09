using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface IApplicationRepository : IRepository<Application>
{
    Task<IReadOnlyList<Application>> GetByStudentAsync(int studentId, CancellationToken cancellationToken = default);
    /// <summary>One page of applications to an internship, newest first.</summary>
    Task<(IReadOnlyList<Application> Items, int Total)> GetByInternshipAsync(
        int internshipId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Application>> GetByCompanyAsync(int companyId, CancellationToken cancellationToken = default);
    Task<Application?> GetByStudentAndInternshipAsync(int studentId, int internshipId, CancellationToken cancellationToken = default);
    Task<Application?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
}
