using Linker.Application.DTOs.Skills;
using Linker.Application.DTOs.Students;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/skills")]
public class SkillsController : ApiControllerBase
{
    private readonly ISkillService _skillService;

    public SkillsController(ISkillService skillService)
    {
        _skillService = skillService;
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<SkillResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SkillResponse>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await _skillService.GetAllAsync(cancellationToken));
    }

    [HttpPost("assign")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<StudentProfileResponse>> Assign(AssignSkillRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _skillService.AssignToStudentAsync(CurrentUserId, request, cancellationToken));
    }

    [HttpDelete("assign/{skillId:int}")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> Remove(int skillId, CancellationToken cancellationToken)
    {
        return Ok(await _skillService.RemoveFromStudentAsync(CurrentUserId, skillId, cancellationToken));
    }
}
