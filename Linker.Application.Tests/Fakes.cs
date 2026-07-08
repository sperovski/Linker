using Linker.Application.Common.Interfaces;
using Linker.Application.Services;

namespace Linker.Application.Tests;

/// <summary>Captures sent emails so verification/reset flows can assert on them.</summary>
public sealed class FakeEmailSender : IEmailSender
{
    public List<(string To, string Subject, string Body)> Sent { get; } = [];

    public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        Sent.Add((toEmail, subject, htmlBody));
        return Task.CompletedTask;
    }
}

/// <summary>No-op notifications for service tests that don't assert on the bell.</summary>
public sealed class NoOpNotificationService : INotificationService
{
    public void Create(int userId, string message, string? link) { }
    public Task<Linker.Application.DTOs.Notifications.NotificationListResponse> GetForUserAsync(int userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(new Linker.Application.DTOs.Notifications.NotificationListResponse([], 0));
    public Task MarkReadAsync(int userId, int notificationId, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task MarkAllReadAsync(int userId, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
