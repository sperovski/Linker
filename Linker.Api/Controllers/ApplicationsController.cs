using Linker.Application.DTOs.Applications;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/applications")]
public class ApplicationsController : ApiControllerBase
{
    private readonly IApplicationService _applicationService;

    public ApplicationsController(IApplicationService applicationService)
    {
        _applicationService = applicationService;
    }

    [HttpPost]
    [Authorize(Roles = "Student", Policy = "VerifiedEmail")]
    [ProducesResponseType(typeof(ApplicationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApplicationResponse>> Apply(CreateApplicationRequest request, CancellationToken cancellationToken)
    {
        var application = await _applicationService.ApplyAsync(CurrentUserId, request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = application.Id }, application);
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(IReadOnlyList<ApplicationResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ApplicationResponse>>> GetOwnApplications(CancellationToken cancellationToken)
    {
        return Ok(await _applicationService.GetOwnApplicationsAsync(CurrentUserId, cancellationToken));
    }

    [HttpGet("{id:int}")]
    [Authorize]
    [ProducesResponseType(typeof(ApplicationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApplicationResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        return Ok(await _applicationService.GetByIdAsync(CurrentUserId, id, cancellationToken));
    }

    [HttpPost("{id:int}/withdraw")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(ApplicationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApplicationResponse>> Withdraw(int id, CancellationToken cancellationToken)
    {
        return Ok(await _applicationService.WithdrawAsync(CurrentUserId, id, cancellationToken));
    }

    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(ApplicationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApplicationResponse>> UpdateStatus(int id, UpdateApplicationStatusRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _applicationService.UpdateStatusAsync(CurrentUserId, id, request, cancellationToken));
    }
}
