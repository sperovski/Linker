using Linker.Domain.Enums;

namespace Linker.Domain.Entities;

/// <summary>
/// A threaded chat room. Its <see cref="Type"/> and the CompanyId/InternshipId FKs
/// must stay consistent — a Company room has a CompanyId and no InternshipId, an
/// Internship room the reverse, and a General room neither. That invariant is
/// enforced in the constructor so a room can never be built in an inconsistent
/// state; use the factory methods rather than newing this up directly.
/// </summary>
public class ChatRoom
{
    public const int MaxTitleLength = 150;

    public int Id { get; private set; }
    public ChatRoomType Type { get; private set; }
    public int? CompanyId { get; private set; }
    public int? InternshipId { get; private set; }
    public string Title { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }

    public Company? Company { get; private set; }
    public Internship? Internship { get; private set; }
    public ICollection<ChatMessage> Messages { get; private set; } = new List<ChatMessage>();

    /// <summary>For EF Core materialisation only.</summary>
    private ChatRoom() { }

    private ChatRoom(ChatRoomType type, int? companyId, int? internshipId, string title, DateTime createdAt)
    {
        var consistent = type switch
        {
            ChatRoomType.Company => companyId is not null && internshipId is null,
            ChatRoomType.Internship => internshipId is not null && companyId is null,
            ChatRoomType.General => companyId is null && internshipId is null,
            _ => false,
        };
        if (!consistent)
        {
            throw new ArgumentException(
                $"ChatRoom of type {type} has an inconsistent CompanyId/InternshipId combination.");
        }

        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("ChatRoom title cannot be empty.", nameof(title));
        }
        title = title.Trim();
        if (title.Length > MaxTitleLength)
        {
            throw new ArgumentException($"ChatRoom title cannot exceed {MaxTitleLength} characters.", nameof(title));
        }

        Type = type;
        CompanyId = companyId;
        InternshipId = internshipId;
        Title = title;
        CreatedAt = createdAt;
    }

    public static ChatRoom ForCompany(int companyId, string title, DateTime createdAt) =>
        new(ChatRoomType.Company, companyId, null, title, createdAt);

    public static ChatRoom ForInternship(int internshipId, string title, DateTime createdAt) =>
        new(ChatRoomType.Internship, null, internshipId, title, createdAt);

    public static ChatRoom CreateGeneral(string title, DateTime createdAt) =>
        new(ChatRoomType.General, null, null, title, createdAt);
}
