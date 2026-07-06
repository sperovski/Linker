using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class InternshipSkillConfiguration : IEntityTypeConfiguration<InternshipSkill>
{
    public void Configure(EntityTypeBuilder<InternshipSkill> builder)
    {
        builder.HasKey(isk => new { isk.InternshipId, isk.SkillId });

        // Cascade from both sides: join rows carry no data of their own, so
        // removing an internship or a skill can safely remove the association.
        builder.HasOne(isk => isk.Internship)
            .WithMany(i => i.RequiredSkills)
            .HasForeignKey(isk => isk.InternshipId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(isk => isk.Skill)
            .WithMany(s => s.InternshipSkills)
            .HasForeignKey(isk => isk.SkillId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
