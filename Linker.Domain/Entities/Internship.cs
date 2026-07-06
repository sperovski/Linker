using Linker.Domain.Enums;

namespace Linker.Domain.Entities;

public class Internship
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string? Location { get; set; }
    public InternshipType Type { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateOnly? ApplicationDeadline { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public Company Company { get; set; } = null!;
    public ICollection<Application> Applications { get; set; } = new List<Application>();
    public ICollection<InternshipSkill> RequiredSkills { get; set; } = new List<InternshipSkill>();
    public ICollection<SavedInternship> SavedBy { get; set; } = new List<SavedInternship>();
}
