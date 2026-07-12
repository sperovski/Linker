using Linker.Application.DTOs.Chat;
using Linker.Application.DTOs.Common;

namespace Linker.Application.Services;

public interface IChatService
{
    Task<ChatRoomResponse> GetGeneralRoomAsync(int userId, CancellationToken cancellationToken = default);
    Task<ChatRoomResponse> GetOrCreateRoomForCompanyAsync(int userId, int companyId, CancellationToken cancellationToken = default);
    Task<ChatRoomResponse> GetOrCreateRoomForInternshipAsync(int userId, int internshipId, CancellationToken cancellationToken = default);

    /// <summary>Authorizes that the user may see the room; throws otherwise. Used by the hub's JoinRoom.</summary>
    Task EnsureCanViewRoomAsync(int userId, int roomId, CancellationToken cancellationToken = default);

    Task<PagedResponse<ChatMessageResponse>> GetMessagesAsync(int userId, int roomId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<ChatMessageResponse> PostMessageAsync(int userId, int roomId, string body, CancellationToken cancellationToken = default);
    Task ReportMessageAsync(int userId, int messageId, string reason, CancellationToken cancellationToken = default);

    /// <summary>Moderator-only soft delete.</summary>
    Task DeleteMessageAsync(int moderatorUserId, int messageId, CancellationToken cancellationToken = default);
}
