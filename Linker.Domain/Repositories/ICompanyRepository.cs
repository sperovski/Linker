using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface ICompanyRepository : IRepository<Company>
{
    Task<Company?> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>The company with its user account loaded — needed wherever the account's own state (email, verification) is read.</summary>
    Task<Company?> GetByIdWithUserAsync(int companyId, CancellationToken cancellationToken = default);

    /// <summary>One page of companies with their user account loaded, newest first, plus the overall total.</summary>
    Task<(IReadOnlyList<Company> Items, int Total)> ListPagedWithUserAsync(int page, int pageSize, CancellationToken cancellationToken = default);
}
