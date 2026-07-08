using Linker.Domain.Entities;
using Linker.Domain.Enums;

namespace Linker.Domain.Repositories;

public interface IInternshipRepository : IRepository<Internship>
{
    Task<IReadOnlyList<Internship>> GetByCompanyAsync(int companyId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetActiveAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetAllWithCompanyAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> SearchActiveAsync(string? location, string? searchText, InternshipType? type, CancellationToken cancellationToken = default);
    Task<Internship?> GetWithCompanyAsync(int id, CancellationToken cancellationToken = default);
    Task<Internship?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetByIdsAsync(IReadOnlyCollection<int> ids, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetPopularActiveAsync(int take, CancellationToken cancellationToken = default);
}
