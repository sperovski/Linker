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
    /// <summary>Short tagline shown under the name, LinkedIn-style.</summary>
    public string? Headline { get; set; }
    public string? ProfilePhotoUrl { get; set; }
    public string? LinkedInUrl { get; set; }
    public string? GithubUrl { get; set; }
    public string? PortfolioUrl { get; set; }
    public string? CvUrl { get; set; }

    public User User { get; set; } = null!;
    public ICollection<StudentSkill> Skills { get; set; } = new List<StudentSkill>();
    public ICollection<Application> Applications { get; set; } = new List<Application>();
    public ICollection<SavedInternship> SavedInternships { get; set; } = new List<SavedInternship>();
    public ICollection<Experience> Experiences { get; set; } = new List<Experience>();
    public ICollection<Education> Educations { get; set; } = new List<Education>();
    public ICollection<Project> Projects { get; set; } = new List<Project>();
}
