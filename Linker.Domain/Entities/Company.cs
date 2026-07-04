namespace Linker.Domain.Entities;

public class Company
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Website { get; set; }

    public User User { get; set; } = null!;
    public ICollection<Internship> Internships { get; set; } = new List<Internship>();
}
