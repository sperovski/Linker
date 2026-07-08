using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class NotificationRepository : Repository<Notification>, INotificationRepository
{
    public NotificationRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<Notification>> GetForUserAsync(int userId, int take, CancellationToken cancellationToken = default)
    {
        return await Context.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> CountUnreadAsync(int userId, CancellationToken cancellationToken = default)
    {
        return await Context.Notifications
            .CountAsync(n => n.UserId == userId && n.ReadAtUtc == null, cancellationToken);
    }

    public async Task<Notification?> GetOwnedAsync(int id, int userId, CancellationToken cancellationToken = default)
    {
        return await Context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, cancellationToken);
    }

    public async Task MarkAllReadAsync(int userId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await Context.Notifications
            .Where(n => n.UserId == userId && n.ReadAtUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAtUtc, now), cancellationToken);
    }
}
