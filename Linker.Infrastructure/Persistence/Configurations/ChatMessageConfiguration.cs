using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Body)
            .IsRequired()
            .HasMaxLength(ChatMessage.MaxBodyLength);

        builder.Property(m => m.CreatedAt).IsRequired();
        builder.Property(m => m.IsDeleted).IsRequired();
        builder.Property(m => m.IsFlagged).IsRequired();

        // The one query this feature runs constantly: a room's messages, newest
        // first, paginated. Without this composite index that becomes a full scan
        // of the messages table per page load — a real DoS surface once history
        // grows, which is exactly why it's here and not left to a default.
        builder.HasIndex(m => new { m.RoomId, m.CreatedAt });

        // Messages belong to their room: cascade so deleting a room removes its
        // messages (a message can't outlive its room).
        builder.HasOne(m => m.Room)
            .WithMany(r => r.Messages)
            .HasForeignKey(m => m.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict on the sender: authorship is preserved and users are soft-
        // disabled (IsActive=false), never hard-deleted — matching the
        // Application → Student convention. This also avoids a second cascade
        // path into ChatMessage.
        builder.HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
