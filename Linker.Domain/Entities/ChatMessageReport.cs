namespace Linker.Domain.Entities;

/// <summary>
/// A user's report against a chat message. The reason is length-checked in the
/// domain; resolution is an explicit state change (<see cref="Resolve"/>) rather
/// than a public setter.
/// </summary>
public class ChatMessageReport
{
    public const int MaxReasonLength = 300;

    public int Id { get; private set; }
    public int MessageId { get; private set; }
    public int ReporterId { get; private set; }
    public string Reason { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public bool Resolved { get; private set; }

    public ChatMessage Message { get; private set; } = null!;
    public User Reporter { get; private set; } = null!;

    /// <summary>For EF Core materialisation only.</summary>
    private ChatMessageReport() { }

    public ChatMessageReport(int messageId, int reporterId, string reason, DateTime createdAt)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Report reason cannot be empty.", nameof(reason));
        }
        reason = reason.Trim();
        if (reason.Length > MaxReasonLength)
        {
            throw new ArgumentException($"Report reason cannot exceed {MaxReasonLength} characters.", nameof(reason));
        }

        MessageId = messageId;
        ReporterId = reporterId;
        Reason = reason;
        CreatedAt = createdAt;
    }

    /// <summary>Marks the report as handled by a moderator.</summary>
    public void Resolve() => Resolved = true;
}
