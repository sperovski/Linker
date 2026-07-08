using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    /// <summary>Revoke every active refresh token for a user (e.g. after a password reset).</summary>
    Task RevokeAllForUserAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>Revoke every active refresh token in a rotation lineage (a replay was detected).</summary>
    Task RevokeFamilyAsync(Guid familyId, CancellationToken cancellationToken = default);
}
