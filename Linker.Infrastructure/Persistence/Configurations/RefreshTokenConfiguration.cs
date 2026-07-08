using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.TokenHash)
            .IsRequired()
            .HasMaxLength(100);

        // Lookups happen by hash on every refresh.
        builder.HasIndex(t => t.TokenHash)
            .IsUnique();

        builder.Property(t => t.CreatedAtUtc).IsRequired();
        builder.Property(t => t.ExpiresAtUtc).IsRequired();

        // Tokens are session state, not history: they go with the account.
        builder.HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
