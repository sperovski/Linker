using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class ChatRoomConfiguration : IEntityTypeConfiguration<ChatRoom>
{
    public void Configure(EntityTypeBuilder<ChatRoom> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Type).IsRequired();

        builder.Property(r => r.Title)
            .IsRequired()
            .HasMaxLength(ChatRoom.MaxTitleLength);

        builder.Property(r => r.CreatedAt).IsRequired();

        // One room per company and one per internship. Postgres treats NULLs as
        // distinct in a unique index, so the many General/other rooms (which leave
        // these columns null) never collide with each other.
        builder.HasIndex(r => r.CompanyId).IsUnique();
        builder.HasIndex(r => r.InternshipId).IsUnique();

        // Cascade down the ownership chain: a room has no meaning without its
        // parent. Companies/internships are normally soft-closed (IsActive=false),
        // which does NOT touch the room — so live chat history is preserved in the
        // normal flow; cascade only bites on an actual hard delete of the parent.
        builder.HasOne(r => r.Company)
            .WithMany()
            .HasForeignKey(r => r.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Internship)
            .WithMany()
            .HasForeignKey(r => r.InternshipId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
