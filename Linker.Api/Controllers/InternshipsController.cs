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
    private readonly ISavedInternshipService _savedInternshipService;

    public InternshipsController(
        IInternshipService internshipService,
        IApplicationService applicationService,
        ISavedInternshipService savedInternshipService)
    {
        _internshipService = internshipService;
        _applicationService = applicationService;
        _savedInternshipService = savedInternshipService;
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<InternshipListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InternshipListItemResponse>>> Search(
        [FromQuery] string? location, [FromQuery] string? searchText, [FromQuery] string? type, CancellationToken cancellationToken)
    {
        var request = new InternshipSearchRequest(location, searchText, type);
        return Ok(await _internshipService.SearchAsync(request, CurrentUserIdOrNull, cancellationToken));
    }

    [HttpGet("saved")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(IReadOnlyList<InternshipListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InternshipListItemResponse>>> GetSaved(CancellationToken cancellationToken)
    {
        return Ok(await _savedInternshipService.GetSavedAsync(CurrentUserId, cancellationToken));
    }

    [HttpGet("recommended")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(IReadOnlyList<InternshipListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InternshipListItemResponse>>> GetRecommended([FromQuery] int take, CancellationToken cancellationToken)
    {
        return Ok(await _internshipService.GetRecommendedAsync(CurrentUserId, take <= 0 ? 6 : take, cancellationToken));
    }

    [HttpGet("popular")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<InternshipListItemResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InternshipListItemResponse>>> GetPopular([FromQuery] int take, CancellationToken cancellationToken)
    {
        return Ok(await _internshipService.GetPopularAsync(take <= 0 ? 6 : take, CurrentUserIdOrNull, cancellationToken));
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
        return Ok(await _internshipService.GetDetailAsync(id, CurrentUserIdOrNull, cancellationToken));
    }

    [HttpPost("{id:int}/save")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Save(int id, CancellationToken cancellationToken)
    {
        await _savedInternshipService.SaveAsync(CurrentUserId, id, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:int}/save")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Unsave(int id, CancellationToken cancellationToken)
    {
        await _savedInternshipService.UnsaveAsync(CurrentUserId, id, cancellationToken);
        return NoContent();
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
