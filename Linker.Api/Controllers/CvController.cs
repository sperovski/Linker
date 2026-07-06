using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Cv;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/cv")]
public class CvController : ApiControllerBase
{
    private const long MaxUploadBytes = 5 * 1024 * 1024;

    private readonly ICvReviewService _cvReviewService;
    private readonly ICvTextExtractor _cvTextExtractor;

    public CvController(ICvReviewService cvReviewService, ICvTextExtractor cvTextExtractor)
    {
        _cvReviewService = cvReviewService;
        _cvTextExtractor = cvTextExtractor;
    }

    [HttpPost("review")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(CvReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CvReviewResponse>> Review(CvReviewRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _cvReviewService.ReviewAsync(CurrentUserId, request, cancellationToken));
    }

    [HttpPost("review/file")]
    [Authorize(Roles = "Student")]
    [RequestSizeLimit(MaxUploadBytes)]
    [ProducesResponseType(typeof(CvFileReviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CvFileReviewResponse>> ReviewFile(
        [FromForm] IFormFile file, [FromForm] int? internshipId, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            throw new BadRequestException("No file was uploaded.");
        }

        if (file.Length > MaxUploadBytes)
        {
            throw new BadRequestException("That file is too large — the limit is 5 MB.");
        }

        byte[] content;
        await using (var stream = new MemoryStream())
        {
            await file.CopyToAsync(stream, cancellationToken);
            content = stream.ToArray();
        }

        var text = _cvTextExtractor.Extract(content, file.FileName);
        var review = await _cvReviewService.ReviewAsync(CurrentUserId, new CvReviewRequest(text, internshipId), cancellationToken);

        return Ok(new CvFileReviewResponse(text, file.FileName, review));
    }
}
