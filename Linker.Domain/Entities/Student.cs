namespace Linker.Domain.Entities;

public class Student
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string FirstName { get; set; } = null!;
    public string LastName { get; set; } = null!;
    public string? University { get; set; }
    public int? GraduationYear { get; set; }
    public string? Bio { get; set; }

    public User User { get; set; } = null!;
    public ICollection<StudentSkill> Skills { get; set; } = new List<StudentSkill>();
    public ICollection<Application> Applications { get; set; } = new List<Application>();
}
