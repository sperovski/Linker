using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

/// <summary>
/// One repository for the whole chat aggregate (rooms, messages, reports). These
/// three are tightly coupled and always used together, so a single repository is
/// cleaner than three near-empty ones — reads stage nothing, writes stage via
/// Add* and commit through IUnitOfWork, matching the rest of the codebase.
/// </summary>
public interface IChatRepository
{
    /// <summary>Loads a room with its Company/Internship, for authorization checks.</summary>
    Task<ChatRoom?> GetRoomAsync(int roomId, CancellationToken cancellationToken = default);
    Task<ChatRoom?> GetRoomByCompanyAsync(int companyId, CancellationToken cancellationToken = default);
    Task<ChatRoom?> GetRoomByInternshipAsync(int internshipId, CancellationToken cancellationToken = default);
    Task<ChatRoom?> GetGeneralRoomAsync(CancellationToken cancellationToken = default);
    Task<ChatRoom?> GetRoomByFacultyAsync(string facultyName, CancellationToken cancellationToken = default);
    void AddRoom(ChatRoom room);

    /// <summary>
    /// One page of a room's messages, newest first, EXCLUDING soft-deleted ones —
    /// deleted messages are never returned through this regular-client path. The
    /// sender's Student/Company is included so a display name resolves without an
    /// N+1. Total counts only visible (non-deleted) messages.
    /// </summary>
    Task<(IReadOnlyList<ChatMessage> Items, int Total)> GetMessagesAsync(
        int roomId, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>Loads a single message (tracked, so Flag/SoftDelete persist).</summary>
    Task<ChatMessage?> GetMessageAsync(int messageId, CancellationToken cancellationToken = default);
    void AddMessage(ChatMessage message);

    Task<bool> ReportExistsAsync(int messageId, int reporterId, CancellationToken cancellationToken = default);
    void AddReport(ChatMessageReport report);
}
