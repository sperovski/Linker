namespace Linker.Api.Middleware;

/// <summary>
/// Confines a session whose password no longer meets the policy: while the
/// <c>must_change_password</c> claim is true, every authenticated API and hub
/// request is refused except the handful needed to set a new password.
///
/// This sits in the pipeline rather than in the frontend because a redirect in
/// the client is a convenience, not a control — the token would otherwise still
/// open every endpoint to anyone holding it. Anonymous traffic is untouched, so
/// browsing and the sign-in flow keep working normally.
/// </summary>
public class PasswordRotationMiddleware
{
    /// <summary>
    /// The only paths a confined session may still reach: reading the account,
    /// changing the password, refreshing the token pair that carries the claim,
    /// and signing out. Without the first two there would be no way out.
    /// </summary>
    private static readonly string[] AllowedPaths =
    [
        "/api/auth/me",
        "/api/auth/change-password",
        "/api/auth/refresh",
        "/api/auth/logout",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/verify-email",
        "/api/auth/resend-verification",
    ];

    private readonly RequestDelegate _next;

    public PasswordRotationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (RequiresRotation(context) && !IsAllowed(context.Request.Path))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(new
            {
                status = StatusCodes.Status403Forbidden,
                title = "Password change required",
                detail = "Your password no longer meets our security requirements. " +
                         "Choose a new one in your security settings to continue.",
                // Lets the client distinguish this from an ordinary authorization
                // failure and route to the settings page instead of showing an error.
                code = "password_change_required"
            });
            return;
        }

        await _next(context);
    }

    private static bool RequiresRotation(HttpContext context) =>
        context.User.Identity?.IsAuthenticated == true &&
        context.User.HasClaim("must_change_password", "true");

    private static bool IsAllowed(PathString path) =>
        AllowedPaths.Any(allowed => path.StartsWithSegments(allowed, StringComparison.OrdinalIgnoreCase));
}
