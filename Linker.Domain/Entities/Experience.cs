namespace Linker.Domain.Entities;

public class Experience
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string Title { get; set; } = null!;
    public string Company { get; set; } = null!;
    public string? Location { get; set; }
    public DateOnly StartDate { get; set; }
    /// <summary>Null means this is the student's current position.</summary>
    public DateOnly? EndDate { get; set; }
    public string? Description { get; set; }

    public Student Student { get; set; } = null!;
}
