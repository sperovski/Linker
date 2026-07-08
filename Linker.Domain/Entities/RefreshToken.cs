namespace Linker.Domain.Entities;

public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }

    /// <summary>SHA-256 hash of the raw token; the raw value is only ever held by the client.</summary>
    public string TokenHash { get; set; } = null!;

    /// <summary>
    /// Shared by every token descended from one login via rotation. Lets a
    /// detected replay (a revoked token presented again) revoke the whole
    /// lineage instead of just the one request, forcing full re-authentication.
    /// </summary>
    public Guid FamilyId { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }

    public User User { get; set; } = null!;

    public bool IsActive => RevokedAtUtc is null && ExpiresAtUtc > DateTime.UtcNow;
}
