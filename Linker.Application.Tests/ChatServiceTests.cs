using Linker.Application.Common.Exceptions;
using Linker.Application.Services;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

/// <summary>
/// Covers the v1 visibility model: any active student may view and post in any
/// room, a company may view only its own rooms and never post, an admin may
/// view all and moderate.
/// </summary>
public class ChatServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly ChatService _service;

    public ChatServiceTests()
    {
        var context = _db.Context;
        _service = new ChatService(
            new ChatRepository(context),
            new UserRepository(context),
            new StudentRepository(context),
            new CompanyRepository(context),
            new InternshipRepository(context),
            context);
    }

    public void Dispose() => _db.Dispose();

    private User AddAdmin()
    {
        var admin = new User
        {
            Email = "admin@test.local",
            PasswordHash = "hash",
            Role = UserRole.Admin,
            CreatedAtUtc = DateTime.UtcNow
        };
        _db.Context.Users.Add(admin);
        _db.Save();
        return admin;
    }

    /// <summary>Company and internship rooms are created by SaveChangesAsync.</summary>
    private int RoomIdForCompany(Company company) =>
        _db.Context.ChatRooms.Single(r => r.CompanyId == company.Id).Id;

    // ---- Posting ---------------------------------------------------------

    [Fact]
    public async Task PostMessage_AsAStudent_Succeeds()
    {
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());

        var message = await _service.PostMessageAsync(student.UserId, roomId, "Hello everyone");

        Assert.Equal("Hello everyone", message.Body);
        Assert.Equal("Test Student", message.SenderName);
    }

    [Fact]
    public async Task PostMessage_TrimsWhitespace()
    {
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());

        var message = await _service.PostMessageAsync(student.UserId, roomId, "  padded  ");

        Assert.Equal("padded", message.Body);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task PostMessage_WithNoContent_IsRejected(string body)
    {
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.PostMessageAsync(student.UserId, roomId, body));
    }

    [Fact]
    public async Task PostMessage_OverTheLengthLimit_IsRejected()
    {
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.PostMessageAsync(student.UserId, roomId, new string('x', ChatMessage.MaxBodyLength + 1)));
    }

    [Fact]
    public async Task PostMessage_AsACompany_IsForbidden()
    {
        var company = _db.AddCompany();

        // Companies can read their rooms but cannot post in v1.
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.PostMessageAsync(company.UserId, RoomIdForCompany(company), "Hi"));
    }

    [Fact]
    public async Task PostMessage_FromADisabledAccount_IsForbidden()
    {
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());
        _db.Context.Users.Single(u => u.Id == student.UserId).IsActive = false;
        _db.Save();

        // A short-lived token can outlive a ban, so IsActive is rechecked here.
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.PostMessageAsync(student.UserId, roomId, "Hi"));
    }

    [Fact]
    public async Task PostMessage_ToAnUnknownRoom_IsNotFound()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.PostMessageAsync(student.UserId, 9999, "Hi"));
    }

    // ---- Faculty channels ------------------------------------------------

    private const string KnownFaculty = "Faculty of Medicine";

    [Fact]
    public async Task FacultyRoom_IsCreatedOnFirstOpen()
    {
        var student = _db.AddStudent();

        var room = await _service.GetOrCreateRoomForFacultyAsync(student.UserId, KnownFaculty);

        Assert.Equal("Faculty", room.Type);
        Assert.Equal(KnownFaculty, room.Title);
        Assert.Null(room.CompanyId);
        Assert.Null(room.InternshipId);
    }

    [Fact]
    public async Task FacultyRoom_IsReusedOnSecondOpen()
    {
        var first = _db.AddStudent("a@test.local");
        var second = _db.AddStudent("b@test.local");

        var a = await _service.GetOrCreateRoomForFacultyAsync(first.UserId, KnownFaculty);
        var b = await _service.GetOrCreateRoomForFacultyAsync(second.UserId, KnownFaculty);

        Assert.Equal(a.Id, b.Id);
        Assert.Single(_db.NewContext().ChatRooms.Where(r => r.Title == KnownFaculty));
    }

    [Fact]
    public async Task FacultyRoom_TrimsTheName()
    {
        var student = _db.AddStudent();

        var room = await _service.GetOrCreateRoomForFacultyAsync(student.UserId, $"  {KnownFaculty}  ");

        Assert.Equal(KnownFaculty, room.Title);
    }

    [Theory]
    [InlineData("Hogwarts")]
    [InlineData("faculty of medicine")] // wrong casing is not a known faculty
    [InlineData("")]
    public async Task FacultyRoom_ForAnUnknownName_IsNotFoundAndCreatesNothing(string name)
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetOrCreateRoomForFacultyAsync(student.UserId, name));

        // A made-up name must never spawn a junk room.
        Assert.Empty(_db.NewContext().ChatRooms.Where(r => r.Type == Linker.Domain.Enums.ChatRoomType.Faculty));
    }

    [Fact]
    public async Task FacultyRoom_LetsAnyStudentPost()
    {
        var student = _db.AddStudent();
        var room = await _service.GetOrCreateRoomForFacultyAsync(student.UserId, KnownFaculty);

        var message = await _service.PostMessageAsync(student.UserId, room.Id, "Hello faculty");

        Assert.Equal("Hello faculty", message.Body);
    }

    [Fact]
    public async Task FacultyRoom_IsHiddenFromCompanies()
    {
        var student = _db.AddStudent();
        var company = _db.AddCompany();
        var room = await _service.GetOrCreateRoomForFacultyAsync(student.UserId, KnownFaculty);

        // Faculty channels are a students-and-admins space.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.EnsureCanViewRoomAsync(company.UserId, room.Id));
    }

    // ---- Room visibility -------------------------------------------------

    [Fact]
    public async Task EnsureCanViewRoom_LetsACompanyViewItsOwnRoom()
    {
        var company = _db.AddCompany();

        await _service.EnsureCanViewRoomAsync(company.UserId, RoomIdForCompany(company));
    }

    [Fact]
    public async Task EnsureCanViewRoom_HidesAnotherCompanysRoom()
    {
        var mine = _db.AddCompany();
        var theirs = _db.AddCompany("other@test.local", "Other Co");

        // NotFound rather than Forbidden, so room ids can't be enumerated.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.EnsureCanViewRoomAsync(mine.UserId, RoomIdForCompany(theirs)));
    }

    [Fact]
    public async Task EnsureCanViewRoom_LetsAnyStudentViewAnyRoom()
    {
        var student = _db.AddStudent();

        await _service.EnsureCanViewRoomAsync(student.UserId, RoomIdForCompany(_db.AddCompany()));
    }

    [Fact]
    public async Task EnsureCanViewRoom_LetsAnAdminViewAnyRoom()
    {
        var admin = AddAdmin();

        await _service.EnsureCanViewRoomAsync(admin.Id, RoomIdForCompany(_db.AddCompany()));
    }

    // ---- Messages --------------------------------------------------------

    [Fact]
    public async Task GetMessages_ReturnsWhatWasPosted()
    {
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());
        await _service.PostMessageAsync(student.UserId, roomId, "First");
        await _service.PostMessageAsync(student.UserId, roomId, "Second");

        var page = await _service.GetMessagesAsync(student.UserId, roomId, 1, 20);

        Assert.Equal(2, page.Total);
    }

    [Fact]
    public async Task GetMessages_FromAnotherCompanysRoom_IsNotFound()
    {
        var mine = _db.AddCompany();
        var theirs = _db.AddCompany("other@test.local", "Other Co");

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetMessagesAsync(mine.UserId, RoomIdForCompany(theirs), 1, 20));
    }

    // ---- Reporting -------------------------------------------------------

    [Fact]
    public async Task ReportMessage_FlagsIt()
    {
        var author = _db.AddStudent();
        var reporter = _db.AddStudent("reporter@test.local");
        var roomId = RoomIdForCompany(_db.AddCompany());
        var message = await _service.PostMessageAsync(author.UserId, roomId, "Spam");

        await _service.ReportMessageAsync(reporter.UserId, message.Id, "This is spam");

        Assert.True(_db.NewContext().ChatMessages.Single(m => m.Id == message.Id).IsFlagged);
    }

    [Fact]
    public async Task ReportMessage_Twice_ThrowsConflict()
    {
        var author = _db.AddStudent();
        var reporter = _db.AddStudent("reporter@test.local");
        var roomId = RoomIdForCompany(_db.AddCompany());
        var message = await _service.PostMessageAsync(author.UserId, roomId, "Spam");
        await _service.ReportMessageAsync(reporter.UserId, message.Id, "This is spam");

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ReportMessageAsync(reporter.UserId, message.Id, "Still spam"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ReportMessage_WithoutAReason_IsRejected(string reason)
    {
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());
        var message = await _service.PostMessageAsync(student.UserId, roomId, "Hello");

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.ReportMessageAsync(student.UserId, message.Id, reason));
    }

    [Fact]
    public async Task ReportMessage_UnknownMessage_IsNotFound()
    {
        var student = _db.AddStudent();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ReportMessageAsync(student.UserId, 9999, "Spam"));
    }

    // ---- Moderation ------------------------------------------------------

    [Fact]
    public async Task DeleteMessage_AsAnAdmin_SoftDeletes()
    {
        var admin = AddAdmin();
        var student = _db.AddStudent();
        var roomId = RoomIdForCompany(_db.AddCompany());
        var message = await _service.PostMessageAsync(student.UserId, roomId, "Bad");

        await _service.DeleteMessageAsync(admin.Id, message.Id);

        // Soft delete: the row survives for moderation history.
        Assert.True(_db.NewContext().ChatMessages.Single(m => m.Id == message.Id).IsDeleted);
    }

    [Fact]
    public async Task DeleteMessage_AsAStudent_IsForbidden()
    {
        var author = _db.AddStudent();
        var other = _db.AddStudent("other@test.local");
        var roomId = RoomIdForCompany(_db.AddCompany());
        var message = await _service.PostMessageAsync(author.UserId, roomId, "Hello");

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.DeleteMessageAsync(other.UserId, message.Id));
    }

    [Fact]
    public async Task ReportMessage_AlreadyDeleted_IsNotFound()
    {
        var admin = AddAdmin();
        var author = _db.AddStudent();
        var reporter = _db.AddStudent("reporter@test.local");
        var roomId = RoomIdForCompany(_db.AddCompany());
        var message = await _service.PostMessageAsync(author.UserId, roomId, "Bad");
        await _service.DeleteMessageAsync(admin.Id, message.Id);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ReportMessageAsync(reporter.UserId, message.Id, "Spam"));
    }
}
