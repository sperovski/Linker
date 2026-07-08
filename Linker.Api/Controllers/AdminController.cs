using Linker.Application.DTOs.Admin;
using Linker.Application.DTOs.Skills;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ApiControllerBase
{
    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpGet("stats")]
    [ProducesResponseType(typeof(AdminStatsResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AdminStatsResponse>> GetStats(CancellationToken cancellationToken)
    {
        return Ok(await _adminService.GetStatsAsync(cancellationToken));
    }

    [HttpGet("users")]
    [ProducesResponseType(typeof(IReadOnlyList<AdminUserResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AdminUserResponse>>> GetUsers(CancellationToken cancellationToken)
    {
        return Ok(await _adminService.ListUsersAsync(cancellationToken));
    }

    [HttpPost("users/{id:int}/active")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetUserActive(int id, SetUserActiveRequest request, CancellationToken cancellationToken)
    {
        await _adminService.SetUserActiveAsync(CurrentUserId, id, request.IsActive, cancellationToken);
        return NoContent();
    }

    [HttpGet("internships")]
    [ProducesResponseType(typeof(IReadOnlyList<AdminInternshipResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AdminInternshipResponse>>> GetInternships(CancellationToken cancellationToken)
    {
        return Ok(await _adminService.ListInternshipsAsync(cancellationToken));
    }

    [HttpPost("internships/{id:int}/close")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CloseInternship(int id, CancellationToken cancellationToken)
    {
        await _adminService.CloseInternshipAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("skills")]
    [ProducesResponseType(typeof(SkillResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<SkillResponse>> CreateSkill(CreateSkillRequest request, CancellationToken cancellationToken)
    {
        var skill = await _adminService.CreateSkillAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, skill);
    }
}
