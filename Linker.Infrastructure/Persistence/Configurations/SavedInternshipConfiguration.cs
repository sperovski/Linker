using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class SavedInternshipConfiguration : IEntityTypeConfiguration<SavedInternship>
{
    public void Configure(EntityTypeBuilder<SavedInternship> builder)
    {
        builder.HasKey(si => new { si.StudentId, si.InternshipId });

        builder.Property(si => si.SavedAtUtc)
            .IsRequired();

        // Cascade: a bookmark is a personal, disposable association. Removing the
        // student or the internship can safely remove the bookmark with it.
        builder.HasOne(si => si.Student)
            .WithMany(s => s.SavedInternships)
            .HasForeignKey(si => si.StudentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(si => si.Internship)
            .WithMany(i => i.SavedBy)
            .HasForeignKey(si => si.InternshipId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
