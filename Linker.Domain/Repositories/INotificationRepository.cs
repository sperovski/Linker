using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface INotificationRepository : IRepository<Notification>
{
    Task<IReadOnlyList<Notification>> GetForUserAsync(int userId, int take, CancellationToken cancellationToken = default);
    Task<int> CountUnreadAsync(int userId, CancellationToken cancellationToken = default);
    Task<Notification?> GetOwnedAsync(int id, int userId, CancellationToken cancellationToken = default);
    Task MarkAllReadAsync(int userId, CancellationToken cancellationToken = default);
}
