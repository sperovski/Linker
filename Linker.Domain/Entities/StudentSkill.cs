namespace Linker.Domain.Entities;

public class StudentSkill
{
    public int StudentId { get; set; }
    public int SkillId { get; set; }

    public Student Student { get; set; } = null!;
    public Skill Skill { get; set; } = null!;
}
