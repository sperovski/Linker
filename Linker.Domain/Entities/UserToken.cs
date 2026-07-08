using Linker.Domain.Enums;

namespace Linker.Domain.Entities;

/// <summary>
/// Single-use, hashed, expiring token for email verification and password reset.
/// The raw value only ever lives in the emailed link; we store its SHA-256 hash.
/// </summary>
public class UserToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public UserTokenPurpose Purpose { get; set; }
    public string TokenHash { get; set; } = null!;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? UsedAtUtc { get; set; }

    public User User { get; set; } = null!;

    public bool IsUsable => UsedAtUtc is null && ExpiresAtUtc > DateTime.UtcNow;
}
