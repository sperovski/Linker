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

/// <summary>
/// In-memory CV storage. Managed urls use the "uploads/" prefix, mirroring the
/// real LocalCvFileStorage's distinction between files it owns and external
/// links a student pasted in.
/// </summary>
public sealed class FakeCvFileStorage : ICvFileStorage
{
    private readonly Dictionary<string, CvFileContent> _files = [];

    public List<string> Deleted { get; } = [];

    public Task<string> SaveAsync(int studentId, string fileName, byte[] content, CancellationToken cancellationToken = default)
    {
        var url = $"uploads/{studentId}/{fileName}";
        _files[url] = new CvFileContent(content, "application/pdf", fileName);
        return Task.FromResult(url);
    }

    public Task<CvFileContent?> OpenAsync(string? url, CancellationToken cancellationToken = default) =>
        Task.FromResult(url is not null && _files.TryGetValue(url, out var file) ? file : null);

    public bool IsManaged(string? url) => url?.StartsWith("uploads/", StringComparison.Ordinal) == true;

    public void DeleteIfManaged(string? url)
    {
        if (IsManaged(url))
        {
            Deleted.Add(url!);
            _files.Remove(url!);
        }
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
