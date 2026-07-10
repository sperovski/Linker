namespace Linker.Domain.Entities;

public class Project
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? Url { get; set; }
    /// <summary>Comma-separated technology tags (e.g. "Angular, .NET, Postgres").</summary>
    public string? TechStack { get; set; }

    public Student Student { get; set; } = null!;
}
