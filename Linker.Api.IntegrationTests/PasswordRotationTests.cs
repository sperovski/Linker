using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Linker.Api.IntegrationTests;

/// <summary>
/// The rotation gate is a middleware, not a client-side redirect, so these
/// exercise it over real HTTP: a confined token must open nothing but the way
/// out, and must open normally again once the password is replaced.
/// </summary>
public class PasswordRotationTests : IClassFixture<LinkerApiFactory>
{
    private readonly LinkerApiFactory _factory;

    public PasswordRotationTests(LinkerApiFactory factory) => _factory = factory;

    private record AuthBody(int userId, string email, string role, string token, string refreshToken,
        bool emailVerified, bool mustChangePassword);

    private const string WeakPassword = "password";
    private const string StrongPassword = "Rotated-Pass-7";

    /// <summary>An account as it would exist from before the policy: weak hash written straight to the DB.</summary>
    private async Task<string> SeedLegacyAccountAsync()
    {
        var email = $"legacy-{Guid.NewGuid():N}@test.local";
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LinkerDbContext>();
        db.Users.Add(new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(WeakPassword),
            Role = UserRole.Student,
            CreatedAtUtc = DateTime.UtcNow,
            EmailVerified = true,
            IsActive = true
        });
        db.Students.Add(new Student
        {
            FirstName = "Legacy",
            LastName = "Account",
            User = db.Users.Local.First(u => u.Email == email)
        });
        await db.SaveChangesAsync();
        return email;
    }

    private async Task<AuthBody> LoginAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthBody>())!;
    }

    [Fact]
    public async Task LegacyPassword_ConfinesTheSession_UntilItIsChanged()
    {
        var client = _factory.CreateClient();
        var email = await SeedLegacyAccountAsync();

        var login = await LoginAsync(client, email, WeakPassword);
        Assert.True(login.mustChangePassword);

        var confined = _factory.CreateClient();
        confined.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.token);

        // An ordinary authenticated endpoint is refused...
        var blocked = await confined.GetAsync("/api/students/me");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("password_change_required", await blocked.Content.ReadAsStringAsync());

        // ...while the two calls that make escape possible still work.
        Assert.Equal(HttpStatusCode.OK, (await confined.GetAsync("/api/auth/me")).StatusCode);

        var changed = await confined.PostAsJsonAsync("/api/auth/change-password",
            new { currentPassword = WeakPassword, newPassword = StrongPassword });
        Assert.Equal(HttpStatusCode.NoContent, changed.StatusCode);

        // A fresh token after the change is no longer confined.
        var relogin = await LoginAsync(client, email, StrongPassword);
        Assert.False(relogin.mustChangePassword);

        var free = _factory.CreateClient();
        free.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", relogin.token);
        Assert.Equal(HttpStatusCode.OK, (await free.GetAsync("/api/students/me")).StatusCode);
    }

    [Fact]
    public async Task CompliantPassword_IsNeverConfined()
    {
        var client = _factory.CreateClient();
        var email = $"fine-{Guid.NewGuid():N}@test.local";
        await client.PostAsJsonAsync("/api/auth/register/student",
            new { email, password = StrongPassword, firstName = "Fine", lastName = "Account" });

        var login = await LoginAsync(client, email, StrongPassword);

        Assert.False(login.mustChangePassword);
        var authed = _factory.CreateClient();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.token);
        Assert.Equal(HttpStatusCode.OK, (await authed.GetAsync("/api/students/me")).StatusCode);
    }

    [Fact]
    public async Task AnonymousBrowsing_IsUnaffected()
    {
        var client = _factory.CreateClient();

        // The gate keys off a claim, so unauthenticated traffic never meets it.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/internships")).StatusCode);
    }
}
