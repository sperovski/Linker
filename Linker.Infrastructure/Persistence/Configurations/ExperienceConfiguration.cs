using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class ExperienceConfiguration : IEntityTypeConfiguration<Experience>
{
    public void Configure(EntityTypeBuilder<Experience> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Title)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(e => e.Company)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(e => e.Location)
            .HasMaxLength(150);

        builder.Property(e => e.Description)
            .HasMaxLength(2000);

        // The profile page always loads a student's entries together.
        builder.HasIndex(e => e.StudentId);

        builder.HasOne(e => e.Student)
            .WithMany(s => s.Experiences)
            .HasForeignKey(e => e.StudentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
