using System.Net;
using System.Text;
using System.Threading.RateLimiting;
using Linker.Api.Middleware;
using Linker.Api.RateLimiting;
using Linker.Application;
using Linker.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Structured request/app logging; JSON in Production, readable console in dev.
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console(formatProvider: System.Globalization.CultureInfo.InvariantCulture));

// Add services to the container.

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Persist DataProtection keys when a path is configured (containers/cloud set
// DataProtection__KeysPath to a mounted volume). Without this every container
// recreation mints a new keyring and invalidates anything it protected.
var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    Directory.CreateDirectory(dataProtectionKeysPath);
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
        .SetApplicationName("Linker");
}

builder.Services.AddHealthChecks()
    .AddDbContextCheck<Linker.Infrastructure.Persistence.LinkerDbContext>("database");

builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddSingleton<Linker.Api.RateLimiting.IChatRateLimiter, Linker.Api.RateLimiting.ChatRateLimiter>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Linker API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the JWT returned by /api/auth/login (without the 'Bearer ' prefix)."
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

const string CorsPolicy = "Frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:4200"];
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod());
});

// Credential endpoints get a strict per-IP budget; everything else a generous one.
// The partition key is the *real* client IP: see ClientIpResolver for why that
// requires an explicit trusted-proxy list rather than the raw connection IP.
var globalPermitLimit = builder.Configuration.GetValue("RateLimiting:GlobalPerMinute", 300);
var authPermitLimit = builder.Configuration.GetValue("RateLimiting:AuthPerMinute", 10);

List<IPNetwork> trustedProxies;
try
{
    trustedProxies = (builder.Configuration.GetSection("RateLimiting:TrustedProxies").Get<string[]>() ?? [])
        .Select(IPNetwork.Parse)
        .ToList();
}
catch (FormatException ex)
{
    throw new InvalidOperationException(
        "One or more entries in 'RateLimiting:TrustedProxies' is not a valid CIDR (e.g. '172.16.0.0/12').", ex);
}

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientIpResolver.Resolve(context, trustedProxies),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = globalPermitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientIpResolver.Resolve(context, trustedProxies),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = authPermitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/problem+json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            status = StatusCodes.Status429TooManyRequests,
            title = "Too Many Requests",
            detail = "Rate limit exceeded. Please wait a moment and try again."
        }, cancellationToken);
    };
});

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException(
        "JWT signing key 'Jwt:Key' is not configured. Set it via user-secrets or the Jwt__Key environment variable.");
}

// HS256 is only as strong as this key; fail fast on one that's trivially
// brute-forceable rather than let a weak deployment limp along.
if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "JWT signing key 'Jwt:Key' must be at least 32 bytes (256 bits) for HS256. Generate a longer random key.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            // Default 5-minute clock skew defeats a 15-minute token; keep it tight.
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        // WebSockets can't send an Authorization header, so SignalR passes the JWT
        // as the access_token query param. Only honour it for the chat hub path —
        // query-string tokens can leak into logs/referrers, so the exposure is kept
        // to the one endpoint that needs it; every other route still requires the
        // header.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(accessToken) &&
                    context.HttpContext.Request.Path.StartsWithSegments("/hubs/chat"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// Opt-in gate (Auth__RequireVerifiedEmail=true): applying and posting require a
// verified email. Off by default so dev/demo flows aren't blocked on SMTP.
var requireVerifiedEmail = builder.Configuration.GetValue("Auth:RequireVerifiedEmail", false);
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("VerifiedEmail", policy =>
        policy.RequireAssertion(context =>
            !requireVerifiedEmail ||
            context.User.HasClaim("email_verified", "true") ||
            context.User.IsInRole("Admin")));
});

var app = builder.Build();

// Containers and cloud hosts opt in via Database__MigrateOnStartup=true;
// local dev keeps using `dotnet ef database update` explicitly.
if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider
        .GetRequiredService<Linker.Infrastructure.Persistence.LinkerDbContext>()
        .Database.MigrateAsync();
}

// Idempotent: admin seeds when Seed:AdminEmail/Password are set; demo data
// additionally requires Database__SeedDemoData=true and empty tables.
{
    using var scope = app.Services.CreateScope();
    await Linker.Infrastructure.Persistence.DbSeeder.SeedAsync(
        scope.ServiceProvider.GetRequiredService<Linker.Infrastructure.Persistence.LinkerDbContext>(),
        app.Configuration,
        app.Logger);
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseSerilogRequestLogging();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

app.UseHttpsRedirection();

// Ensure the uploads volume exists on boot. CV files are NOT served as static
// content — a CV is personal data, so it's streamed only through the authorised
// GET /api/students/{id}/cv endpoint (see StudentsController.DownloadCv).
var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), app.Configuration["Storage:UploadsPath"] ?? "uploads");
Directory.CreateDirectory(uploadsPath);

app.UseCors(CorsPolicy);

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Real-time chat hub. It sits behind UseAuthentication/UseAuthorization above and
// UseCors, so the WebSocket handshake obeys the same restrictive origin allowlist
// as the REST API — it is not opened up wide. CloseOnAuthenticationExpiration
// tears the connection down when the JWT expires, so a socket can't linger with
// stale auth; the client reconnects with a fresh token.
app.MapHub<Linker.Api.Hubs.ChatHub>("/hubs/chat", options =>
{
    options.CloseOnAuthenticationExpiration = true;
});

// Liveness/readiness for containers and cloud hosts (checks Postgres).
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();

public partial class Program;
