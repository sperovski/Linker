namespace Linker.Domain.Entities;

public class InternshipSkill
{
    public int InternshipId { get; set; }
    public int SkillId { get; set; }

    public Internship Internship { get; set; } = null!;
    public Skill Skill { get; set; } = null!;
}
