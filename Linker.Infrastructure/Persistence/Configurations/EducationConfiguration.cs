using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class EducationConfiguration : IEntityTypeConfiguration<Education>
{
    public void Configure(EntityTypeBuilder<Education> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Institution)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(e => e.Degree)
            .HasMaxLength(150);

        builder.Property(e => e.FieldOfStudy)
            .HasMaxLength(150);

        builder.HasIndex(e => e.StudentId);

        builder.HasOne(e => e.Student)
            .WithMany(s => s.Educations)
            .HasForeignKey(e => e.StudentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
