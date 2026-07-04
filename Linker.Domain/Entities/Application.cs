using Linker.Domain.Enums;

namespace Linker.Domain.Entities;

public class Application
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int InternshipId { get; set; }
    public ApplicationStatus Status { get; set; }
    public string? CoverLetter { get; set; }
    public DateTime AppliedAtUtc { get; set; }

    public Student Student { get; set; } = null!;
    public Internship Internship { get; set; } = null!;
}
