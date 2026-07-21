using Linker.Application.DTOs.Chat;
using Linker.Application.DTOs.Common;
using Linker.Application.Services;
using Linker.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/chatrooms")]
[Authorize]
public class ChatRoomsController : ApiControllerBase
{
    private readonly IChatService _chatService;

    public ChatRoomsController(IChatService chatService)
    {
        _chatService = chatService;
    }

    [HttpGet("general")]
    [ProducesResponseType(typeof(ChatRoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatRoomResponse>> General(CancellationToken cancellationToken)
    {
        return Ok(await _chatService.GetGeneralRoomAsync(CurrentUserId, cancellationToken));
    }

    [HttpGet("company/{companyId:int}")]
    [ProducesResponseType(typeof(ChatRoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatRoomResponse>> ForCompany(int companyId, CancellationToken cancellationToken)
    {
        return Ok(await _chatService.GetOrCreateRoomForCompanyAsync(CurrentUserId, companyId, cancellationToken));
    }

    [HttpGet("internship/{internshipId:int}")]
    [ProducesResponseType(typeof(ChatRoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatRoomResponse>> ForInternship(int internshipId, CancellationToken cancellationToken)
    {
        return Ok(await _chatService.GetOrCreateRoomForInternshipAsync(CurrentUserId, internshipId, cancellationToken));
    }

    /// <summary>The list of faculty channels the sidebar offers (authoritative names).</summary>
    [HttpGet("faculties")]
    [ProducesResponseType(typeof(IReadOnlyList<string>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<string>> Faculties()
    {
        return Ok(UkimFaculties.All);
    }

    // Opens (creating on first use) a faculty channel. The name is validated
    // against the known UKIM faculties server-side, so an arbitrary name 404s
    // rather than creating a junk room.
    [HttpGet("faculty")]
    [ProducesResponseType(typeof(ChatRoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatRoomResponse>> ForFaculty([FromQuery] string name, CancellationToken cancellationToken)
    {
        return Ok(await _chatService.GetOrCreateRoomForFacultyAsync(CurrentUserId, name, cancellationToken));
    }

    // Initial history load. Enforces the same room-visibility rule as the hub's
    // JoinRoom — you can't page a room's history just by guessing a roomId.
    [HttpGet("{roomId:int}/messages")]
    [ProducesResponseType(typeof(PagedResponse<ChatMessageResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResponse<ChatMessageResponse>>> Messages(
        int roomId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = Paging.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _chatService.GetMessagesAsync(CurrentUserId, roomId, page, pageSize, cancellationToken));
    }

    [HttpPost("messages/{messageId:int}/report")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Report(int messageId, ReportChatMessageRequest request, CancellationToken cancellationToken)
    {
        await _chatService.ReportMessageAsync(CurrentUserId, messageId, request.Reason, cancellationToken);
        return NoContent();
    }

    [HttpDelete("messages/{messageId:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int messageId, CancellationToken cancellationToken)
    {
        await _chatService.DeleteMessageAsync(CurrentUserId, messageId, cancellationToken);
        return NoContent();
    }
}
