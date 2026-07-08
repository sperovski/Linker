using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class UserTokenRepository : Repository<UserToken>, IUserTokenRepository
{
    public UserTokenRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<UserToken?> GetUsableAsync(string tokenHash, UserTokenPurpose purpose, CancellationToken cancellationToken = default)
    {
        return await Context.UserTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.Purpose == purpose, cancellationToken);
    }

    public async Task InvalidateExistingAsync(int userId, UserTokenPurpose purpose, CancellationToken cancellationToken = default)
    {
        // Only one live token per purpose: issuing a new one supersedes older ones.
        var now = DateTime.UtcNow;
        await Context.UserTokens
            .Where(t => t.UserId == userId && t.Purpose == purpose && t.UsedAtUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAtUtc, now), cancellationToken);
    }
}
