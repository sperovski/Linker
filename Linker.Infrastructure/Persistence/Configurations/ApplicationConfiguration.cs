using Linker.Domain.Entities;
using ApplicationEntity = Linker.Domain.Entities.Application;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class ApplicationConfiguration : IEntityTypeConfiguration<ApplicationEntity>
{
    public void Configure(EntityTypeBuilder<ApplicationEntity> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Status)
            .IsRequired();

        builder.Property(a => a.CoverLetter)
            .HasMaxLength(4000);

        builder.Property(a => a.AppliedAtUtc)
            .IsRequired();

        // A student can apply to a given internship only once.
        builder.HasIndex(a => new { a.StudentId, a.InternshipId })
            .IsUnique();

        // Restrict on both sides: an application is a shared record between a
        // student and a company. Deleting either party must not silently erase
        // the other party's view of the application history.
        builder.HasOne(a => a.Student)
            .WithMany(s => s.Applications)
            .HasForeignKey(a => a.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.Internship)
            .WithMany(i => i.Applications)
            .HasForeignKey(a => a.InternshipId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
