using Linker.Application.DTOs.Notifications;

namespace Linker.Application.Services;

public interface INotificationService
{
    /// <summary>Stages a notification for a user. Caller commits via the unit of work.</summary>
    void Create(int userId, string message, string? link);

    Task<NotificationListResponse> GetForUserAsync(int userId, CancellationToken cancellationToken = default);
    Task MarkReadAsync(int userId, int notificationId, CancellationToken cancellationToken = default);
    Task MarkAllReadAsync(int userId, CancellationToken cancellationToken = default);
}
