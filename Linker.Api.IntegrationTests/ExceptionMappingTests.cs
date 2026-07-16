using Linker.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Linker.Api.IntegrationTests;

/// <summary>
/// Unit-level checks of ExceptionHandlingMiddleware's non-domain mappings —
/// the paths that used to fall through to a 500.
/// </summary>
public class ExceptionMappingTests
{
    private static ExceptionHandlingMiddleware Middleware(RequestDelegate next) =>
        new(next, NullLogger<ExceptionHandlingMiddleware>.Instance);

    private static DefaultHttpContext NewContext()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        return context;
    }

    [Fact]
    public async Task DbUpdateException_MapsTo409_WithoutLeakingConstraintText()
    {
        // The message a Postgres unique-violation would carry; it must never
        // reach the response body.
        var middleware = Middleware(_ => throw new DbUpdateException(
            "duplicate key value violates unique constraint \"IX_Users_Email\""));
        var context = NewContext();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.DoesNotContain("IX_Users_Email", body);
        Assert.Contains("conflicts", body);
    }

    [Fact]
    public async Task ClientCancellation_DoesNotMapTo500()
    {
        var middleware = Middleware(_ => throw new OperationCanceledException());
        var context = NewContext();
        context.RequestAborted = new CancellationToken(canceled: true);

        await middleware.InvokeAsync(context);

        Assert.Equal(499, context.Response.StatusCode);
    }

    [Fact]
    public async Task CancellationNotFromClient_StillMapsTo500()
    {
        // e.g. an internal timeout token fired while the caller is still
        // waiting — that IS a server fault and must stay visible.
        var middleware = Middleware(_ => throw new OperationCanceledException());
        var context = NewContext();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
    }
}
