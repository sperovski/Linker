using System.ComponentModel.DataAnnotations;
using Linker.Domain.Entities;

namespace Linker.Application.DTOs.Chat;

public record ChatRoomResponse(int Id, string Type, string Title, int? CompanyId, int? InternshipId);

/// <summary>
/// A message as sent to clients. Deliberately minimal: a display name and the
/// sender's user id (so the client can align "my" messages), never the sender's
/// email or any other account detail.
/// </summary>
public record ChatMessageResponse(
    int Id,
    int RoomId,
    int SenderId,
    string SenderName,
    string Body,
    DateTime CreatedAt);

public record ReportChatMessageRequest(
    [Required, MaxLength(ChatMessageReport.MaxReasonLength)] string Reason);
