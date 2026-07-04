using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class StudentSkillConfiguration : IEntityTypeConfiguration<StudentSkill>
{
    public void Configure(EntityTypeBuilder<StudentSkill> builder)
    {
        builder.HasKey(ss => new { ss.StudentId, ss.SkillId });

        // Cascade from both sides: join rows carry no data of their own, so
        // removing a student or a skill can safely remove the association.
        builder.HasOne(ss => ss.Student)
            .WithMany(s => s.Skills)
            .HasForeignKey(ss => ss.StudentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ss => ss.Skill)
            .WithMany(s => s.StudentSkills)
            .HasForeignKey(ss => ss.SkillId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
