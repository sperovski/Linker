namespace Linker.Application.DTOs.Notifications;

public record NotificationResponse(
    int Id,
    string Message,
    string? Link,
    bool IsRead,
    DateTime CreatedAtUtc);

public record NotificationListResponse(
    IReadOnlyList<NotificationResponse> Items,
    int UnreadCount);
