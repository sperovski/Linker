using Linker.Domain.Enums;

namespace Linker.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public UserRole Role { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public Student? Student { get; set; }
    public Company? Company { get; set; }
}
