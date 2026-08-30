using Linker.Application.Common.Exceptions;
using Linker.Application.Services;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;

namespace Linker.Application.Tests;

/// <summary>
/// Covers the visibility model: any active student may view and post in any room;
/// a company may view and post in General and in its own rooms but never in
/// another company's; an admin may view all and moderate but not post.
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
            context,
            // Verified-email enforcement has its own tests; these fixtures create
            // users directly and are about the visibility rules, so switch it off.
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["Auth:RequireVerifiedEmail"] = "false" })
                .Build());
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
    public async Task PostMessage_AsACompany_InItsOwnRoom_IsAllowed()
    {
        var company = _db.AddCompany();

        var message = await _service.PostMessageAsync(company.UserId, RoomIdForCompany(company), "We're hiring!");

        Assert.Equal("Company", message.SenderRole);
        Assert.Equal(company.Name, message.SenderCompanyName);
    }

    [Fact]
    public async Task PostMessage_AsACompany_InAnotherCompanysRoom_IsNotFound()
    {
        var mine = _db.AddCompany();
        var theirs = _db.AddCompany("other@test.local", "Other Co");

        // Posting can never reach further than viewing, so this is the same
        // NotFound a view attempt would get — not a Forbidden that confirms the room.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.PostMessageAsync(mine.UserId, RoomIdForCompany(theirs), "Hi"));
    }

    [Fact]
    public async Task PostMessage_AsAnAdmin_IsForbidden()
    {
        var admin = AddAdmin();
        var roomId = RoomIdForCompany(_db.AddCompany());

        // Admins moderate rather than participate.
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _service.PostMessageAsync(admin.Id, roomId, "Hi"));
    }

    // ---- Sender badge ----------------------------------------------------

    [Fact]
    public async Task PostMessage_FromAVerifiedCompany_CarriesTheVerifiedBadge()
    {
        var company = _db.AddCompany(isVerified: true);

        var message = await _service.PostMessageAsync(company.UserId, RoomIdForCompany(company), "Hello");

        Assert.True(message.IsVerifiedCompany);
    }

    [Fact]
    public async Task PostMessage_FromAnUnverifiedCompany_DoesNotCarryTheBadge()
    {
        var company = _db.AddCompany(isVerified: false);

        var message = await _service.PostMessageAsync(company.UserId, RoomIdForCompany(company), "Hello");

        Assert.Equal("Company", message.SenderRole);
        Assert.False(message.IsVerifiedCompany);
    }

    [Fact]
    public async Task PostMessage_FromAStudent_IsNeverBadgedAsACompany()
    {
        var student = _db.AddStudent();

        // The badge is derived from the sender's own account row, so a student
        // cannot render as an employer whatever their profile name says.
        var message = await _service.PostMessageAsync(student.UserId, RoomIdForCompany(_db.AddCompany()), "Hi");

        Assert.Equal("Student", message.SenderRole);
        Assert.Null(message.SenderCompanyName);
        Assert.False(message.IsVerifiedCompany);
    }

    [Fact]
    public async Task GetMessages_CarriesTheSendersBadgeIntoHistory()
    {
        var company = _db.AddCompany(isVerified: true);
        var roomId = RoomIdForCompany(company);
        await _service.PostMessageAsync(company.UserId, roomId, "Hello");

        var page = await _service.GetMessagesAsync(company.UserId, roomId, 1, 20);

        var message = Assert.Single(page.Items);
        Assert.Equal("Company", message.SenderRole);
        Assert.True(message.IsVerifiedCompany);
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
