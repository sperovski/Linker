using Linker.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Linker.Infrastructure.Persistence.Configurations;

public class ChatMessageReportConfiguration : IEntityTypeConfiguration<ChatMessageReport>
{
    public void Configure(EntityTypeBuilder<ChatMessageReport> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Reason)
            .IsRequired()
            .HasMaxLength(ChatMessageReport.MaxReasonLength);

        builder.Property(r => r.CreatedAt).IsRequired();
        builder.Property(r => r.Resolved).IsRequired();

        // A user can report a given message at most once — stops a single account
        // spamming the moderation queue to bury a message under repeat reports.
        builder.HasIndex(r => new { r.MessageId, r.ReporterId }).IsUnique();

        builder.HasOne(r => r.Message)
            .WithMany()
            .HasForeignKey(r => r.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.Reporter)
            .WithMany()
            .HasForeignKey(r => r.ReporterId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
