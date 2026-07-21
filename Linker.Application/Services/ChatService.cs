using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Chat;
using Linker.Application.DTOs.Common;
using Linker.Domain;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

/// <summary>
/// All chat authorization and validation lives here, server-side — the hub and
/// the REST controller are thin and both route through these methods, so a client
/// can never bypass a check by talking to one transport instead of the other.
///
/// Visibility model (v1, "open"): any active student may view and post in any
/// room; a company may view only its own rooms and may not post; an admin may
/// view all and moderate. Posting is students-only.
/// </summary>
public class ChatService : IChatService
{
    private readonly IChatRepository _chatRepository;
    private readonly IUserRepository _userRepository;
    private readonly IStudentRepository _studentRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IInternshipRepository _internshipRepository;
    private readonly IUnitOfWork _unitOfWork;

    public ChatService(
        IChatRepository chatRepository,
        IUserRepository userRepository,
        IStudentRepository studentRepository,
        ICompanyRepository companyRepository,
        IInternshipRepository internshipRepository,
        IUnitOfWork unitOfWork)
    {
        _chatRepository = chatRepository;
        _userRepository = userRepository;
        _studentRepository = studentRepository;
        _companyRepository = companyRepository;
        _internshipRepository = internshipRepository;
        _unitOfWork = unitOfWork;
    }

    // ---- Rooms -------------------------------------------------------------

    public async Task<ChatRoomResponse> GetGeneralRoomAsync(int userId, CancellationToken cancellationToken = default)
    {
        var user = await LoadActiveUserAsync(userId, cancellationToken);
        var room = await _chatRepository.GetGeneralRoomAsync(cancellationToken)
            ?? throw new NotFoundException("The General chat room does not exist.");
        return await ViewableOrNotFoundAsync(user, room, cancellationToken);
    }

    public async Task<ChatRoomResponse> GetOrCreateRoomForCompanyAsync(int userId, int companyId, CancellationToken cancellationToken = default)
    {
        var user = await LoadActiveUserAsync(userId, cancellationToken);

        var room = await _chatRepository.GetRoomByCompanyAsync(companyId, cancellationToken);
        if (room is null)
        {
            var company = await _companyRepository.GetByIdAsync(companyId, cancellationToken)
                ?? throw new NotFoundException("Company", companyId);
            room = ChatRoom.ForCompany(company.Id, company.Name, DateTime.UtcNow);
            _chatRepository.AddRoom(room);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return await ViewableOrNotFoundAsync(user, room, cancellationToken);
    }

    public async Task<ChatRoomResponse> GetOrCreateRoomForInternshipAsync(int userId, int internshipId, CancellationToken cancellationToken = default)
    {
        var user = await LoadActiveUserAsync(userId, cancellationToken);

        var room = await _chatRepository.GetRoomByInternshipAsync(internshipId, cancellationToken);
        if (room is null)
        {
            var internship = await _internshipRepository.GetByIdAsync(internshipId, cancellationToken)
                ?? throw new NotFoundException("Internship", internshipId);
            room = ChatRoom.ForInternship(internship.Id, internship.Title, DateTime.UtcNow);
            _chatRepository.AddRoom(room);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            // Re-load so Internship (needed for company view checks) is populated.
            room = await _chatRepository.GetRoomAsync(room.Id, cancellationToken)!;
        }

        return await ViewableOrNotFoundAsync(user, room!, cancellationToken);
    }

    public async Task<ChatRoomResponse> GetOrCreateRoomForFacultyAsync(int userId, string facultyName, CancellationToken cancellationToken = default)
    {
        facultyName = (facultyName ?? string.Empty).Trim();
        // A channel may only exist for a real UKIM faculty, so a client can't
        // spin up arbitrary rooms by posting a made-up name.
        if (!UkimFaculties.IsKnown(facultyName))
        {
            throw new NotFoundException($"'{facultyName}' is not a recognised faculty.");
        }

        var user = await LoadActiveUserAsync(userId, cancellationToken);

        var room = await _chatRepository.GetFacultyRoomAsync(facultyName, cancellationToken);
        if (room is null)
        {
            room = ChatRoom.ForFaculty(facultyName, DateTime.UtcNow);
            _chatRepository.AddRoom(room);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return await ViewableOrNotFoundAsync(user, room, cancellationToken);
    }

    public async Task EnsureCanViewRoomAsync(int userId, int roomId, CancellationToken cancellationToken = default)
    {
        var user = await LoadActiveUserAsync(userId, cancellationToken);
        await GetViewableRoomAsync(user, roomId, cancellationToken);
    }

    // ---- Messages ----------------------------------------------------------

    public async Task<PagedResponse<ChatMessageResponse>> GetMessagesAsync(
        int userId, int roomId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var user = await LoadActiveUserAsync(userId, cancellationToken);
        // Same visibility gate as JoinRoom — you can't read a room's history just
        // by guessing a roomId in the REST call.
        await GetViewableRoomAsync(user, roomId, cancellationToken);

        (page, pageSize) = Paging.Normalize(page, pageSize);
        var (messages, total) = await _chatRepository.GetMessagesAsync(roomId, page, pageSize, cancellationToken);

        var items = messages.Select(ToResponse).ToList();
        return new PagedResponse<ChatMessageResponse>(items, total, page, pageSize);
    }

    public async Task<ChatMessageResponse> PostMessageAsync(int userId, int roomId, string body, CancellationToken cancellationToken = default)
    {
        // Server-side validation, independent of any client check. The domain
        // constructor guards this too; this layer turns it into a friendly 400.
        body = (body ?? string.Empty).Trim();
        if (body.Length == 0)
        {
            throw new BadRequestException("Message cannot be empty.");
        }
        if (body.Length > ChatMessage.MaxBodyLength)
        {
            throw new BadRequestException($"Message cannot exceed {ChatMessage.MaxBodyLength} characters.");
        }

        var user = await LoadActiveUserAsync(userId, cancellationToken);
        if (user.Role != UserRole.Student)
        {
            // Companies can view their rooms but cannot post in v1.
            throw new ForbiddenAccessException("Only students can post messages.");
        }

        // Students may view (and thus post in) any room; still 404s a bad roomId.
        await GetViewableRoomAsync(user, roomId, cancellationToken);

        var message = new ChatMessage(roomId, user.Id, body, DateTime.UtcNow);
        _chatRepository.AddMessage(message);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var senderName = await ResolveSenderNameAsync(user, cancellationToken);
        return new ChatMessageResponse(message.Id, message.RoomId, user.Id, senderName, message.Body, message.CreatedAt);
    }

    public async Task ReportMessageAsync(int userId, int messageId, string reason, CancellationToken cancellationToken = default)
    {
        reason = (reason ?? string.Empty).Trim();
        if (reason.Length == 0)
        {
            throw new BadRequestException("A report reason is required.");
        }
        if (reason.Length > ChatMessageReport.MaxReasonLength)
        {
            throw new BadRequestException($"A report reason cannot exceed {ChatMessageReport.MaxReasonLength} characters.");
        }

        var user = await LoadActiveUserAsync(userId, cancellationToken);

        var message = await _chatRepository.GetMessageAsync(messageId, cancellationToken);
        // Treat a missing OR already-deleted message the same, and require the
        // reporter to be able to see the room it's in — so reporting can't be used
        // to probe for messages/rooms the caller isn't allowed to see.
        if (message is null || message.IsDeleted)
        {
            throw new NotFoundException("Message", messageId);
        }
        await GetViewableRoomAsync(user, message.RoomId, cancellationToken);

        if (await _chatRepository.ReportExistsAsync(messageId, user.Id, cancellationToken))
        {
            throw new ConflictException("You have already reported this message.");
        }

        _chatRepository.AddReport(new ChatMessageReport(messageId, user.Id, reason, DateTime.UtcNow));
        message.Flag();
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteMessageAsync(int moderatorUserId, int messageId, CancellationToken cancellationToken = default)
    {
        var user = await LoadActiveUserAsync(moderatorUserId, cancellationToken);
        if (user.Role != UserRole.Admin)
        {
            throw new ForbiddenAccessException("Only moderators can delete messages.");
        }

        var message = await _chatRepository.GetMessageAsync(messageId, cancellationToken)
            ?? throw new NotFoundException("Message", messageId);

        message.SoftDelete();
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    // ---- Authorization helpers --------------------------------------------

    /// <summary>
    /// Loads the caller and blocks disabled (banned) accounts. A short-lived access
    /// token can outlive a ban, so IsActive is re-checked here on every action —
    /// the token proves identity, this proves the account is still allowed.
    /// </summary>
    private async Task<User> LoadActiveUserAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User", userId);
        if (!user.IsActive)
        {
            throw new ForbiddenAccessException("Your account is not permitted to use chat.");
        }
        return user;
    }

    /// <summary>
    /// Returns the room only if the caller may view it; otherwise throws NotFound —
    /// deliberately the same result for "doesn't exist" and "not allowed", so a
    /// caller can't enumerate room ids by watching for a different error.
    /// </summary>
    private async Task<ChatRoom> GetViewableRoomAsync(User user, int roomId, CancellationToken cancellationToken)
    {
        var room = await _chatRepository.GetRoomAsync(roomId, cancellationToken);
        if (room is null || !await CanViewRoomAsync(user, room, cancellationToken))
        {
            throw new NotFoundException("Chat room", roomId);
        }
        return room;
    }

    private async Task<ChatRoomResponse> ViewableOrNotFoundAsync(User user, ChatRoom room, CancellationToken cancellationToken)
    {
        if (!await CanViewRoomAsync(user, room, cancellationToken))
        {
            throw new NotFoundException("Chat room", room.Id);
        }
        return ToResponse(room);
    }

    private async Task<bool> CanViewRoomAsync(User user, ChatRoom room, CancellationToken cancellationToken) => user.Role switch
    {
        UserRole.Admin => true,
        UserRole.Student => true, // open model: students can view every room
        UserRole.Company => await IsRoomOwnedByUsersCompanyAsync(user.Id, room, cancellationToken),
        _ => false,
    };

    private async Task<bool> IsRoomOwnedByUsersCompanyAsync(int userId, ChatRoom room, CancellationToken cancellationToken)
    {
        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken);
        if (company is null)
        {
            return false;
        }
        return room.Type switch
        {
            ChatRoomType.Company => room.CompanyId == company.Id,
            ChatRoomType.Internship => room.Internship is not null && room.Internship.CompanyId == company.Id,
            _ => false, // General is not a company-owned room
        };
    }

    // ---- Mapping -----------------------------------------------------------

    private static ChatRoomResponse ToResponse(ChatRoom room) =>
        new(room.Id, room.Type.ToString(), room.Title, room.CompanyId, room.InternshipId);

    private static ChatMessageResponse ToResponse(ChatMessage m) =>
        new(m.Id, m.RoomId, m.SenderId, DisplayName(m.Sender), m.Body, m.CreatedAt);

    private async Task<string> ResolveSenderNameAsync(User sender, CancellationToken cancellationToken)
    {
        var student = await _studentRepository.GetByUserIdAsync(sender.Id, cancellationToken);
        if (student is not null)
        {
            return $"{student.FirstName} {student.LastName}".Trim();
        }
        var company = await _companyRepository.GetByUserIdAsync(sender.Id, cancellationToken);
        return company?.Name ?? "Unknown";
    }

    /// <summary>Display name from the loaded sender — never the email or any account secret.</summary>
    private static string DisplayName(User? sender)
    {
        if (sender?.Student is not null)
        {
            return $"{sender.Student.FirstName} {sender.Student.LastName}".Trim();
        }
        return sender?.Company?.Name ?? "Unknown";
    }
}
