using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class InternshipConfiguration : IEntityTypeConfiguration<Internship>
{
    public void Configure(EntityTypeBuilder<Internship> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(i => i.Description)
            .IsRequired()
            .HasMaxLength(8000);

        builder.Property(i => i.Location)
            .HasMaxLength(200);

        builder.Property(i => i.CreatedAtUtc)
            .IsRequired();

        // Restrict: an internship with existing applications must not be silently
        // deletable via company deletion — applications reference it (see
        // ApplicationConfiguration). Deleting a company therefore requires its
        // internships (and their applications) to be handled explicitly first.
        builder.HasOne(i => i.Company)
            .WithMany(c => c.Internships)
            .HasForeignKey(i => i.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
