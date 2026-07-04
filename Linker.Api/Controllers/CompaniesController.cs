using Linker.Application.DTOs.Companies;
using Linker.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[Route("api/companies")]
public class CompaniesController : ApiControllerBase
{
    private readonly ICompanyService _companyService;

    public CompaniesController(ICompanyService companyService)
    {
        _companyService = companyService;
    }

    [HttpGet("me")]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(CompanyProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CompanyProfileResponse>> GetOwnProfile(CancellationToken cancellationToken)
    {
        return Ok(await _companyService.GetByUserIdAsync(CurrentUserId, cancellationToken));
    }

    [HttpPut("me")]
    [Authorize(Roles = "Company")]
    [ProducesResponseType(typeof(CompanyProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CompanyProfileResponse>> UpdateOwnProfile(UpdateCompanyProfileRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _companyService.UpdateProfileAsync(CurrentUserId, request, cancellationToken));
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CompanyProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CompanyProfileResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        return Ok(await _companyService.GetByIdAsync(id, cancellationToken));
    }
}
