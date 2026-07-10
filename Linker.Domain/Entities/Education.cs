namespace Linker.Domain.Entities;

public class Education
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string Institution { get; set; } = null!;
    public string? Degree { get; set; }
    public string? FieldOfStudy { get; set; }
    public DateOnly StartDate { get; set; }
    /// <summary>Null means the student is still enrolled.</summary>
    public DateOnly? EndDate { get; set; }

    public Student Student { get; set; } = null!;
}
