namespace Linker.Domain.Entities;

public class Company
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Website { get; set; }

    /// <summary>
    /// Set by an admin once the company is confirmed to be who it claims. This is
    /// what earns the badge next to their messages in chat, so it is deliberately
    /// not self-service: a company cannot mark itself verified through any
    /// profile-update path.
    /// </summary>
    public bool IsVerified { get; set; }

    public DateTime? VerifiedAtUtc { get; set; }

    public User User { get; set; } = null!;
    public ICollection<Internship> Internships { get; set; } = new List<Internship>();
}
