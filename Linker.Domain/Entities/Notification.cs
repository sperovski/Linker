namespace Linker.Domain.Entities;

/// <summary>In-app notification shown in the header bell; optionally links somewhere.</summary>
public class Notification
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Message { get; set; } = null!;
    public string? Link { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }

    public User User { get; set; } = null!;
}
