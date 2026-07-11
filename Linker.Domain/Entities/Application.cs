using Linker.Domain.Enums;

namespace Linker.Domain.Entities;

public class Application
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int InternshipId { get; set; }
    public ApplicationStatus Status { get; set; }
    public string? CoverNote { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Last status change; equals CreatedAt until the application is acted on.</summary>
    public DateTime UpdatedAt { get; set; }

    public Student Student { get; set; } = null!;
    public Internship Internship { get; set; } = null!;
}
