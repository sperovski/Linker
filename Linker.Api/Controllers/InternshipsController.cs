using Linker.Application.DTOs.Applications;
using Linker.Application.DTOs.Internships;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/internships")]
public class InternshipsController : ApiControllerBase
{
    private readonly IInternshipService _internshipService;
    private readonly IApplicationService _applicationService;

    public InternshipsController(IInternshipService internshipService, IApplicationService applicationService)
    {
        _internshipService = internshipService;
        _applicationService = applicationService;
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<InternshipListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InternshipListItemResponse>>> Search(
        [FromQuery] string? location, [FromQuery] string? searchText, [FromQuery] string? type, CancellationToken cancellationToken)
    {
        var request = new InternshipSearchRequest(location, searchText, type);
        return Ok(await _internshipService.SearchAsync(request, cancellationToken));
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(IReadOnlyList<InternshipListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InternshipListItemResponse>>> GetOwnListings(CancellationToken cancellationToken)
    {
        return Ok(await _internshipService.GetOwnListingsAsync(CurrentUserId, cancellationToken));
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(InternshipDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InternshipDetailResponse>> GetDetail(int id, CancellationToken cancellationToken)
    {
        return Ok(await _internshipService.GetDetailAsync(id, cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(InternshipDetailResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<InternshipDetailResponse>> Create(CreateInternshipRequest request, CancellationToken cancellationToken)
    {
        var internship = await _internshipService.CreateAsync(CurrentUserId, request, cancellationToken);
        return CreatedAtAction(nameof(GetDetail), new { id = internship.Id }, internship);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(InternshipDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InternshipDetailResponse>> Update(int id, UpdateInternshipRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _internshipService.UpdateAsync(CurrentUserId, id, request, cancellationToken));
    }

    [HttpPost("{id:int}/close")]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(InternshipDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InternshipDetailResponse>> Close(int id, CancellationToken cancellationToken)
    {
        return Ok(await _internshipService.CloseAsync(CurrentUserId, id, cancellationToken));
    }

    [HttpGet("{id:int}/applications")]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(IReadOnlyList<ApplicationResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<ApplicationResponse>>> GetApplications(int id, CancellationToken cancellationToken)
    {
        return Ok(await _applicationService.GetByInternshipAsync(CurrentUserId, id, cancellationToken));
    }
}
