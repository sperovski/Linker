namespace Linker.Domain.Entities;

public class Skill
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    /// <summary>Taxonomy group (e.g. "Programming Languages", "Soft Skills") used to group the picker UI.</summary>
    public string Category { get; set; } = "Other";

    public ICollection<StudentSkill> StudentSkills { get; set; } = new List<StudentSkill>();
    public ICollection<InternshipSkill> InternshipSkills { get; set; } = new List<InternshipSkill>();
}
