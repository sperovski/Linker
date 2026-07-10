using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class SkillConfiguration : IEntityTypeConfiguration<Skill>
{
    public void Configure(EntityTypeBuilder<Skill> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name)
            .IsRequired()
            .HasMaxLength(100);

        // Existing rows fall back to the default when the column is added.
        builder.Property(s => s.Category)
            .IsRequired()
            .HasMaxLength(100)
            .HasDefaultValue("Other");

        builder.HasIndex(s => s.Name)
            .IsUnique();
    }
}
