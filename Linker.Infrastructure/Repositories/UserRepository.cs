using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await Context.Users
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
    }

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default)
    {
        return await Context.Users
            .AnyAsync(u => u.Email == email, cancellationToken);
    }

    public async Task<(int Total, int Students, int Companies)> CountByRoleAsync(CancellationToken cancellationToken = default)
    {
        // One aggregate query instead of loading every account into memory.
        var counts = await Context.Users
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Students = g.Count(u => u.Role == Domain.Enums.UserRole.Student),
                Companies = g.Count(u => u.Role == Domain.Enums.UserRole.Company),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return counts is null ? (0, 0, 0) : (counts.Total, counts.Students, counts.Companies);
    }

    public async Task<(IReadOnlyList<User> Items, int Total)> ListPagedAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = Context.Users.AsNoTracking();

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(u => u.CreatedAtUtc)
            .ThenByDescending(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }
}
