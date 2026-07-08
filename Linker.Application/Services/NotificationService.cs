using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Notifications;
using Linker.Domain.Entities;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class NotificationService : INotificationService
{
    private const int FeedSize = 20;

    private readonly INotificationRepository _notificationRepository;
    private readonly IUnitOfWork _unitOfWork;

    public NotificationService(INotificationRepository notificationRepository, IUnitOfWork unitOfWork)
    {
        _notificationRepository = notificationRepository;
        _unitOfWork = unitOfWork;
    }

    public void Create(int userId, string message, string? link)
    {
        // Staged only; the acting service commits it alongside its own changes so
        // the notification and the event that caused it land atomically.
        _notificationRepository.Add(new Notification
        {
            UserId = userId,
            Message = message,
            Link = link,
            CreatedAtUtc = DateTime.UtcNow
        });
    }

    public async Task<NotificationListResponse> GetForUserAsync(int userId, CancellationToken cancellationToken = default)
    {
        var items = await _notificationRepository.GetForUserAsync(userId, FeedSize, cancellationToken);
        var unread = await _notificationRepository.CountUnreadAsync(userId, cancellationToken);

        return new NotificationListResponse(
            items.Select(n => new NotificationResponse(n.Id, n.Message, n.Link, n.ReadAtUtc is not null, n.CreatedAtUtc)).ToList(),
            unread);
    }

    public async Task MarkReadAsync(int userId, int notificationId, CancellationToken cancellationToken = default)
    {
        var notification = await _notificationRepository.GetOwnedAsync(notificationId, userId, cancellationToken)
            ?? throw new NotFoundException("Notification", notificationId);

        if (notification.ReadAtUtc is null)
        {
            notification.ReadAtUtc = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task MarkAllReadAsync(int userId, CancellationToken cancellationToken = default)
    {
        await _notificationRepository.MarkAllReadAsync(userId, cancellationToken);
    }
}
