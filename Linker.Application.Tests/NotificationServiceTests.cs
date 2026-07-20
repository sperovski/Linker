using Linker.Application.Common.Exceptions;
using Linker.Application.Services;
using Linker.Infrastructure.Repositories;

namespace Linker.Application.Tests;

public class NotificationServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly NotificationService _service;

    public NotificationServiceTests()
    {
        var context = _db.Context;
        _service = new NotificationService(new NotificationRepository(context), context);
    }

    public void Dispose() => _db.Dispose();

    /// <summary>Create() only stages; the acting service owns the commit.</summary>
    private async Task<int> CreateAndCommitAsync(int userId, string message = "Hello", string? link = null)
    {
        _service.Create(userId, message, link);
        await _db.Context.SaveChangesAsync();
        var list = await _service.GetForUserAsync(userId);
        return list.Items[0].Id;
    }

    [Fact]
    public async Task Create_StagesWithoutCommitting()
    {
        var student = _db.AddStudent();

        _service.Create(student.UserId, "Staged", null);

        // Nothing is visible until the caller commits its own unit of work.
        Assert.Empty(_db.NewContext().Notifications);
    }

    [Fact]
    public async Task Create_ThenCommit_ShowsInTheFeedAsUnread()
    {
        var student = _db.AddStudent();

        await CreateAndCommitAsync(student.UserId, "You have a new match", "/internships/1");

        var list = await _service.GetForUserAsync(student.UserId);
        var item = Assert.Single(list.Items);
        Assert.Equal("You have a new match", item.Message);
        Assert.Equal("/internships/1", item.Link);
        Assert.False(item.IsRead);
        Assert.Equal(1, list.UnreadCount);
    }

    [Fact]
    public async Task GetForUser_OnlyReturnsTheOwnersNotifications()
    {
        var mine = _db.AddStudent();
        var theirs = _db.AddStudent("other@test.local");
        await CreateAndCommitAsync(theirs.UserId);

        var list = await _service.GetForUserAsync(mine.UserId);

        Assert.Empty(list.Items);
        Assert.Equal(0, list.UnreadCount);
    }

    [Fact]
    public async Task GetForUser_CapsTheFeedAtTwentyButCountsAllUnread()
    {
        var student = _db.AddStudent();
        for (var i = 0; i < 25; i++)
        {
            _service.Create(student.UserId, $"Message {i}", null);
        }
        await _db.Context.SaveChangesAsync();

        var list = await _service.GetForUserAsync(student.UserId);

        Assert.Equal(20, list.Items.Count);
        Assert.Equal(25, list.UnreadCount);
    }

    [Fact]
    public async Task MarkRead_FlipsTheItemAndDropsTheCount()
    {
        var student = _db.AddStudent();
        var id = await CreateAndCommitAsync(student.UserId);

        await _service.MarkReadAsync(student.UserId, id);

        var list = await _service.GetForUserAsync(student.UserId);
        Assert.True(Assert.Single(list.Items).IsRead);
        Assert.Equal(0, list.UnreadCount);
    }

    [Fact]
    public async Task MarkRead_IsIdempotent()
    {
        var student = _db.AddStudent();
        var id = await CreateAndCommitAsync(student.UserId);
        await _service.MarkReadAsync(student.UserId, id);

        await _service.MarkReadAsync(student.UserId, id);

        Assert.Equal(0, (await _service.GetForUserAsync(student.UserId)).UnreadCount);
    }

    [Fact]
    public async Task MarkRead_SomeoneElsesNotification_IsNotFound()
    {
        var owner = _db.AddStudent();
        var intruder = _db.AddStudent("intruder@test.local");
        var id = await CreateAndCommitAsync(owner.UserId);

        await Assert.ThrowsAsync<NotFoundException>(() => _service.MarkReadAsync(intruder.UserId, id));
    }

    [Fact]
    public async Task MarkRead_LeavesTheOwnersCountUntouchedAfterAFailedAttempt()
    {
        var owner = _db.AddStudent();
        var intruder = _db.AddStudent("intruder@test.local");
        var id = await CreateAndCommitAsync(owner.UserId);

        await Assert.ThrowsAsync<NotFoundException>(() => _service.MarkReadAsync(intruder.UserId, id));

        Assert.Equal(1, (await _service.GetForUserAsync(owner.UserId)).UnreadCount);
    }

    [Fact]
    public async Task MarkAllRead_ClearsOnlyTheCallersNotifications()
    {
        var mine = _db.AddStudent();
        var theirs = _db.AddStudent("other@test.local");
        await CreateAndCommitAsync(mine.UserId);
        await CreateAndCommitAsync(theirs.UserId);

        await _service.MarkAllReadAsync(mine.UserId);

        Assert.Equal(0, (await _service.GetForUserAsync(mine.UserId)).UnreadCount);
        Assert.Equal(1, (await _service.GetForUserAsync(theirs.UserId)).UnreadCount);
    }
}
