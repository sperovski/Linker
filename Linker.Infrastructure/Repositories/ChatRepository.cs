using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class ChatRepository : IChatRepository
{
    private readonly LinkerDbContext _context;

    public ChatRepository(LinkerDbContext context)
    {
        _context = context;
    }

    public Task<ChatRoom?> GetRoomAsync(int roomId, CancellationToken cancellationToken = default) =>
        _context.ChatRooms
            .Include(r => r.Internship)
            .FirstOrDefaultAsync(r => r.Id == roomId, cancellationToken);

    public Task<ChatRoom?> GetRoomByCompanyAsync(int companyId, CancellationToken cancellationToken = default) =>
        _context.ChatRooms.FirstOrDefaultAsync(r => r.CompanyId == companyId, cancellationToken);

    public Task<ChatRoom?> GetRoomByInternshipAsync(int internshipId, CancellationToken cancellationToken = default) =>
        _context.ChatRooms
            .Include(r => r.Internship)
            .FirstOrDefaultAsync(r => r.InternshipId == internshipId, cancellationToken);

    public Task<ChatRoom?> GetGeneralRoomAsync(CancellationToken cancellationToken = default) =>
        _context.ChatRooms.FirstOrDefaultAsync(r => r.Type == ChatRoomType.General, cancellationToken);

    public Task<ChatRoom?> GetFacultyRoomAsync(string facultyName, CancellationToken cancellationToken = default) =>
        _context.ChatRooms.FirstOrDefaultAsync(
            r => r.Type == ChatRoomType.Faculty && r.Title == facultyName, cancellationToken);

    public void AddRoom(ChatRoom room) => _context.ChatRooms.Add(room);

    public async Task<(IReadOnlyList<ChatMessage> Items, int Total)> GetMessagesAsync(
        int roomId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        // Soft-deleted messages are filtered out here — this is the enforcement
        // point that keeps deleted content from ever reaching a regular client.
        var query = _context.ChatMessages
            .AsNoTracking()
            .Where(m => m.RoomId == roomId && !m.IsDeleted);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(m => m.Sender).ThenInclude(u => u.Student)
            .Include(m => m.Sender).ThenInclude(u => u.Company)
            // Id breaks CreatedAt ties so a message can't straddle two pages.
            .OrderByDescending(m => m.CreatedAt)
            .ThenByDescending(m => m.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public Task<ChatMessage?> GetMessageAsync(int messageId, CancellationToken cancellationToken = default) =>
        _context.ChatMessages.FirstOrDefaultAsync(m => m.Id == messageId, cancellationToken);

    public void AddMessage(ChatMessage message) => _context.ChatMessages.Add(message);

    public Task<bool> ReportExistsAsync(int messageId, int reporterId, CancellationToken cancellationToken = default) =>
        _context.ChatMessageReports.AnyAsync(r => r.MessageId == messageId && r.ReporterId == reporterId, cancellationToken);

    public void AddReport(ChatMessageReport report) => _context.ChatMessageReports.Add(report);
}
