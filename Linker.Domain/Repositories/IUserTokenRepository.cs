using Linker.Domain.Entities;
using Linker.Domain.Enums;

namespace Linker.Domain.Repositories;

public interface IUserTokenRepository : IRepository<UserToken>
{
    Task<UserToken?> GetUsableAsync(string tokenHash, UserTokenPurpose purpose, CancellationToken cancellationToken = default);
    Task InvalidateExistingAsync(int userId, UserTokenPurpose purpose, CancellationToken cancellationToken = default);
}
