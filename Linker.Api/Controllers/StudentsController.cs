using Linker.Application.DTOs.Students;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/students")]
public class StudentsController : ApiControllerBase
{
    private readonly IStudentService _studentService;

    public StudentsController(IStudentService studentService)
    {
        _studentService = studentService;
    }

    [HttpGet("me")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> GetOwnProfile(CancellationToken cancellationToken)
    {
        return Ok(await _studentService.GetByUserIdAsync(CurrentUserId, cancellationToken));
    }

    [HttpPut("me")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> UpdateOwnProfile(UpdateStudentProfileRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.UpdateProfileAsync(CurrentUserId, request, cancellationToken));
    }

    [HttpGet("{id:int}")]
    [Authorize]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.GetByIdAsync(id, cancellationToken));
    }

    // ---- Profile sections (own profile only; every mutation returns the full profile) ----

    [HttpPost("me/experience")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<StudentProfileResponse>> AddExperience(SaveExperienceRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.AddExperienceAsync(CurrentUserId, request, cancellationToken));
    }

    [HttpPut("me/experience/{id:int}")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> UpdateExperience(int id, SaveExperienceRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.UpdateExperienceAsync(CurrentUserId, id, request, cancellationToken));
    }

    [HttpDelete("me/experience/{id:int}")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> DeleteExperience(int id, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.DeleteExperienceAsync(CurrentUserId, id, cancellationToken));
    }

    [HttpPost("me/education")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<StudentProfileResponse>> AddEducation(SaveEducationRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.AddEducationAsync(CurrentUserId, request, cancellationToken));
    }

    [HttpPut("me/education/{id:int}")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> UpdateEducation(int id, SaveEducationRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.UpdateEducationAsync(CurrentUserId, id, request, cancellationToken));
    }

    [HttpDelete("me/education/{id:int}")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> DeleteEducation(int id, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.DeleteEducationAsync(CurrentUserId, id, cancellationToken));
    }

    [HttpPost("me/projects")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<StudentProfileResponse>> AddProject(SaveProjectRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.AddProjectAsync(CurrentUserId, request, cancellationToken));
    }

    [HttpPut("me/projects/{id:int}")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> UpdateProject(int id, SaveProjectRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.UpdateProjectAsync(CurrentUserId, id, request, cancellationToken));
    }

    [HttpDelete("me/projects/{id:int}")]
    [Authorize(Roles = "Student")]
    [ProducesResponseType(typeof(StudentProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StudentProfileResponse>> DeleteProject(int id, CancellationToken cancellationToken)
    {
        return Ok(await _studentService.DeleteProjectAsync(CurrentUserId, id, cancellationToken));
    }
}
