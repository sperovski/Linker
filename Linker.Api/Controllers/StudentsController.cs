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
}
