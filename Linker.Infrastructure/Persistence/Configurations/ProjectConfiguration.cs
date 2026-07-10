using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Title)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(p => p.Description)
            .HasMaxLength(2000);

        builder.Property(p => p.Url)
            .HasMaxLength(500);

        builder.Property(p => p.TechStack)
            .HasMaxLength(500);

        builder.HasIndex(p => p.StudentId);

        builder.HasOne(p => p.Student)
            .WithMany(s => s.Projects)
            .HasForeignKey(p => p.StudentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
