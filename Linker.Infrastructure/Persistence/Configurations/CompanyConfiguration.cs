using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(c => c.Description)
            .HasMaxLength(4000);

        builder.Property(c => c.Website)
            .HasMaxLength(500);

        // Verification is admin-granted; false for every row that predates it.
        builder.Property(c => c.IsVerified)
            .IsRequired()
            .HasDefaultValue(false);

        // One profile per user account.
        builder.HasIndex(c => c.UserId)
            .IsUnique();

        // Cascade: a company profile cannot exist without its user account.
        builder.HasOne(c => c.User)
            .WithOne(u => u.Company)
            .HasForeignKey<Company>(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
