using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>Account totals computed in SQL — never loads user rows.</summary>
    Task<(int Total, int Students, int Companies)> CountByRoleAsync(CancellationToken cancellationToken = default);

    /// <summary>One page of accounts, newest first, with the overall total.</summary>
    Task<(IReadOnlyList<User> Items, int Total)> ListPagedAsync(int page, int pageSize, CancellationToken cancellationToken = default);
}
