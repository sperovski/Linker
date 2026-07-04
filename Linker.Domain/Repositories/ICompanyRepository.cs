using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface ICompanyRepository : IRepository<Company>
{
    Task<Company?> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default);
}
