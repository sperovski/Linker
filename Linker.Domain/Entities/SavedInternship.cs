namespace Linker.Domain.Entities;

public class SavedInternship
{
    public int StudentId { get; set; }
    public int InternshipId { get; set; }
    public DateTime SavedAtUtc { get; set; }

    public Student Student { get; set; } = null!;
    public Internship Internship { get; set; } = null!;
}
