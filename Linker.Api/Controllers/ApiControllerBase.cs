using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Linker.Api.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    // "sub" is mapped to NameIdentifier by the default inbound claim mapping;
    // fall back to the raw claim in case mapping is disabled.
    protected int CurrentUserId
    {
        get
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("sub")
                ?? throw new InvalidOperationException("Authenticated request is missing the user id claim.");

            return int.Parse(value);
        }
    }
}
