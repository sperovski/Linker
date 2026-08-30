using Linker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;

namespace Linker.Api.IntegrationTests;

/// <summary>
/// Boots the real API against a throwaway Postgres container, so tests exercise
/// the full HTTP + EF + Npgsql stack the way production runs.
/// </summary>
public class LinkerApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting("ConnectionStrings:DefaultConnection", _postgres.GetConnectionString());
        builder.UseSetting("Jwt:Issuer", "Linker.Api");
        builder.UseSetting("Jwt:Audience", "Linker.Client");
        builder.UseSetting("Jwt:Key", "integration-test-signing-key-0123456789abcdef");
        builder.UseSetting("Jwt:AccessTokenMinutes", "15");
        // Migrate inside app startup (before seeding), matching the production
        // boot order — startup seeding queries tables the migrations create.
        builder.UseSetting("Database:MigrateOnStartup", "true");
        // Flow tests share one IP partition; keep the budget well above what a
        // full run needs so they're never throttled. The limiter itself is
        // proven separately in RateLimitTests.
        builder.UseSetting("RateLimiting:AuthPerMinute", "1000");
        // Off here on purpose: these suites exercise search, paging and the
        // apply/review flows, and would otherwise spend every fixture walking a
        // verification link. The gate itself is proven separately in
        // VerifiedEmailGateTests, which flips this back on. Set explicitly rather
        // than inherited, so neither suite depends on which way the app default
        // happens to point.
        builder.UseSetting("Auth:RequireVerifiedEmail", "false");
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // Touching Services builds and starts the host, which migrates + seeds.
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LinkerDbContext>();
        await db.Database.MigrateAsync(); // no-op safety net; startup already migrated
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }
}
