using System.Security.Claims;
using Linker.Api.RateLimiting;
using Linker.Application.Common.Exceptions;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Linker.Api.Hubs;

/// <summary>
/// Real-time chat. Every method derives the caller's identity from the validated
/// JWT (<see cref="HubCallerContext.User"/>) — never from a client argument — and
/// re-runs the same server-side authorization/validation as the REST path via
/// <see cref="IChatService"/>. Messages broadcast only to their room's group,
/// never to all connections.
/// </summary>
[Authorize]
public class ChatHub : Hub
{
    private static string GroupName(int roomId) => $"chat-room-{roomId}";

    private readonly IChatService _chatService;
    private readonly IChatRateLimiter _rateLimiter;

    public ChatHub(IChatService chatService, IChatRateLimiter rateLimiter)
    {
        _chatService = chatService;
        _rateLimiter = rateLimiter;
    }

    /// <summary>
    /// The authenticated user's id, taken from the token the connection was
    /// established with. There is no client-supplied senderId anywhere in this hub,
    /// so a caller cannot act as another user.
    /// </summary>
    private int UserId
    {
        get
        {
            var value = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? Context.User?.FindFirstValue("sub")
                ?? throw new HubException("Not authenticated.");
            return int.Parse(value);
        }
    }

    public async Task JoinRoom(int roomId)
    {
        await GuardAsync(() => _chatService.EnsureCanViewRoomAsync(UserId, roomId));
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(roomId));
    }

    public Task LeaveRoom(int roomId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(roomId));

    public async Task SendMessage(int roomId, string body)
    {
        using var lease = _rateLimiter.Acquire(UserId);
        if (!lease.IsAcquired)
        {
            throw new HubException("You're sending messages too quickly. Please slow down.");
        }

        // Re-runs full validation + authorization server-side; the client's own
        // checks are UX only and carry no trust.
        var message = await GuardAsync(() => _chatService.PostMessageAsync(UserId, roomId, body));

        // Broadcast ONLY to this room's group — never Clients.All.
        await Clients.Group(GroupName(roomId)).SendAsync("ReceiveMessage", message);
    }

    /// <summary>
    /// Translates our domain exceptions into HubExceptions with safe messages.
    /// Anything else bubbles up and SignalR replaces it with a generic error, so
    /// internal details never reach the client. Room "not found" and "not allowed"
    /// deliberately share a message so room ids can't be enumerated.
    /// </summary>
    private static async Task GuardAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (NotFoundException)
        {
            throw new HubException("That chat room isn't available.");
        }
        catch (ForbiddenAccessException ex)
        {
            throw new HubException(ex.Message);
        }
        catch (BadRequestException ex)
        {
            throw new HubException(ex.Message);
        }
        catch (ConflictException ex)
        {
            throw new HubException(ex.Message);
        }
    }

    private static async Task<T> GuardAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return await action();
        }
        catch (NotFoundException)
        {
            throw new HubException("That chat room isn't available.");
        }
        catch (ForbiddenAccessException ex)
        {
            throw new HubException(ex.Message);
        }
        catch (BadRequestException ex)
        {
            throw new HubException(ex.Message);
        }
        catch (ConflictException ex)
        {
            throw new HubException(ex.Message);
        }
    }
}
