using Linker.Application.Common.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Linker.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client went away mid-request: nothing is wrong with the
            // server and nobody is listening for a body, so don't log an
            // error-level 500 for it.
            _logger.LogDebug("Request {Method} {Path} was cancelled by the client",
                context.Request.Method, context.Request.Path);
            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = 499; // nginx's "client closed request"
            }
        }
        catch (Exception exception)
        {
            await HandleExceptionAsync(context, exception);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, title, detail) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, "Not Found", exception.Message),
            BadRequestException => (StatusCodes.Status400BadRequest, "Bad Request", exception.Message),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict", exception.Message),
            ForbiddenAccessException => (StatusCodes.Status403Forbidden, "Forbidden", exception.Message),
            AuthenticationFailedException => (StatusCodes.Status401Unauthorized, "Unauthorized", exception.Message),
            // A unique index beat a check-then-insert to the punch (e.g. two
            // simultaneous registrations with the same email). That's a
            // conflict, not a server fault — and never echo the raw
            // constraint/SQL text to the caller.
            DbUpdateException => (StatusCodes.Status409Conflict, "Conflict",
                "The request conflicts with data that already exists. Please try again."),
            _ => (StatusCodes.Status500InternalServerError, "Internal Server Error",
                "An unexpected error occurred. Please try again later.")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception while processing {Method} {Path}",
                context.Request.Method, context.Request.Path);
        }
        else if (exception is DbUpdateException)
        {
            // Kept visible (unlike the mapped domain exceptions) because a
            // constraint race that happens often points at a missing guard.
            _logger.LogWarning(exception, "Database conflict while processing {Method} {Path}",
                context.Request.Method, context.Request.Path);
        }

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            // Never leak stack traces; internal errors get a generic message.
            Detail = detail,
            Instance = context.Request.Path
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(problemDetails);
    }
}
