using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class StudentConfiguration : IEntityTypeConfiguration<Student>
{
    public void Configure(EntityTypeBuilder<Student> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.FirstName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.LastName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.University)
            .HasMaxLength(200);

        builder.Property(s => s.Bio)
            .HasMaxLength(2000);

        builder.Property(s => s.Headline)
            .HasMaxLength(150);

        builder.Property(s => s.ProfilePhotoUrl)
            .HasMaxLength(500);

        builder.Property(s => s.LinkedInUrl)
            .HasMaxLength(500);

        builder.Property(s => s.GithubUrl)
            .HasMaxLength(500);

        builder.Property(s => s.PortfolioUrl)
            .HasMaxLength(500);

        builder.Property(s => s.CvUrl)
            .HasMaxLength(500);

        // One profile per user account.
        builder.HasIndex(s => s.UserId)
            .IsUnique();

        // Cascade: a student profile cannot exist without its user account.
        builder.HasOne(s => s.User)
            .WithOne(u => u.Student)
            .HasForeignKey<Student>(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
