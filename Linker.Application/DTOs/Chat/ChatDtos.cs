using System.ComponentModel.DataAnnotations;
using Linker.Domain.Entities;

namespace Linker.Application.DTOs.Chat;

public record ChatRoomResponse(int Id, string Type, string Title, int? CompanyId, int? InternshipId);

/// <summary>
/// A message as sent to clients. Deliberately minimal: a display name, the
/// sender's user id (so the client can align "my" messages) and the badge fields
/// below — never the sender's email or any other account detail.
///
/// <para><b>Badge.</b> <see cref="SenderRole"/> and <see cref="SenderCompanyName"/>
/// come from the server's own view of the sender's account, never from anything
/// the client sent, and <see cref="IsVerifiedCompany"/> reflects the admin-granted
/// flag on the company record. A student therefore cannot render as a company, and
/// an unverified company cannot render as a verified one, whatever it types as its
/// display name.</para>
/// </summary>
public record ChatMessageResponse(
    int Id,
    int RoomId,
    int SenderId,
    string SenderName,
    string Body,
    DateTime CreatedAt,
    string SenderRole,
    string? SenderCompanyName,
    bool IsVerifiedCompany);

public record ReportChatMessageRequest(
    [Required, MaxLength(ChatMessageReport.MaxReasonLength)] string Reason);
