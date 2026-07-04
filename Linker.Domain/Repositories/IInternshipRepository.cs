using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface IInternshipRepository : IRepository<Internship>
{
    Task<IReadOnlyList<Internship>> GetByCompanyAsync(int companyId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetActiveAsync(CancellationToken cancellationToken = default);
}
