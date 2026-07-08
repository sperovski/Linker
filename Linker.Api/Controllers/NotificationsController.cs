using Linker.Application.DTOs.Notifications;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/notifications")]
[Authorize]
public class NotificationsController : ApiControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(NotificationListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<NotificationListResponse>> Get(CancellationToken cancellationToken)
    {
        return Ok(await _notificationService.GetForUserAsync(CurrentUserId, cancellationToken));
    }

    [HttpPost("{id:int}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkRead(int id, CancellationToken cancellationToken)
    {
        await _notificationService.MarkReadAsync(CurrentUserId, id, cancellationToken);
        return NoContent();
    }

    [HttpPost("read-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        await _notificationService.MarkAllReadAsync(CurrentUserId, cancellationToken);
        return NoContent();
    }
}
