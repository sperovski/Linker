namespace Linker.Domain.Entities;

/// <summary>
/// A single chat message. Body length and non-emptiness are enforced here in the
/// domain — not just in the UI or the service — so a message can never be
/// persisted over-length or blank regardless of how it was constructed.
///
/// Deletion is soft (<see cref="IsDeleted"/>): the row stays for audit and admin
/// review, and query filters (not this entity) are responsible for hiding deleted
/// messages from regular clients.
/// </summary>
public class ChatMessage
{
    public const int MaxBodyLength = 2000;

    public int Id { get; private set; }
    public int RoomId { get; private set; }
    public int SenderId { get; private set; }
    public string Body { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public bool IsDeleted { get; private set; }
    public bool IsFlagged { get; private set; }

    public ChatRoom Room { get; private set; } = null!;
    public User Sender { get; private set; } = null!;

    /// <summary>For EF Core materialisation only.</summary>
    private ChatMessage() { }

    public ChatMessage(int roomId, int senderId, string body, DateTime createdAt)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new ArgumentException("Message body cannot be empty.", nameof(body));
        }
        body = body.Trim();
        if (body.Length > MaxBodyLength)
        {
            throw new ArgumentException($"Message body cannot exceed {MaxBodyLength} characters.", nameof(body));
        }

        RoomId = roomId;
        SenderId = senderId;
        Body = body;
        CreatedAt = createdAt;
    }

    /// <summary>Soft-deletes the message; the row is retained for admin/audit.</summary>
    public void SoftDelete() => IsDeleted = true;

    /// <summary>Marks the message as flagged by a report, for moderator attention.</summary>
    public void Flag() => IsFlagged = true;
}
