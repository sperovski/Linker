using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Linker.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Linker.Api.IntegrationTests;

/// <summary>Own factory with the verified-email gate switched on.</summary>
public class VerifiedGateApiFactory : LinkerApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Auth:RequireVerifiedEmail", "true");
    }
}

public class VerifiedEmailGateTests : IClassFixture<VerifiedGateApiFactory>
{
    private readonly VerifiedGateApiFactory _factory;

    public VerifiedEmailGateTests(VerifiedGateApiFactory factory) => _factory = factory;

    private record AuthBody(int userId, string email, string role, string token, string refreshToken, bool emailVerified);
    private record InternshipDetail(int id);

    [Fact]
    public async Task UnverifiedStudent_CannotApply_UntilVerified()
    {
        var client = _factory.CreateClient();

        // Company account, force-verified straight in the DB so it can post.
        var coEmail = $"gate-co-{Guid.NewGuid():N}@test.local";
        var co = await (await client.PostAsJsonAsync("/api/auth/register/company",
            new { email = coEmail, password = "password123", name = "Gate Co" }))
            .Content.ReadFromJsonAsync<AuthBody>();
        await MarkVerifiedInDb(coEmail);

        // Re-login so the company token carries email_verified=true.
        var coLogin = await (await client.PostAsJsonAsync("/api/auth/login",
            new { email = coEmail, password = "password123" })).Content.ReadFromJsonAsync<AuthBody>();
        var coClient = _factory.CreateClient();
        coClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", coLogin!.token);
        var listing = await (await coClient.PostAsJsonAsync("/api/internships", new
        {
            title = "Gate Intern",
            description = "Exercises the verified-email gate.",
            type = "Internship",
            skillIds = new[] { await TestData.AnySkillIdAsync(client) }
        })).Content.ReadFromJsonAsync<InternshipDetail>();

        // Fresh student: unverified, apply must be forbidden.
        var stEmail = $"gate-st-{Guid.NewGuid():N}@test.local";
        var st = await (await client.PostAsJsonAsync("/api/auth/register/student",
            new { email = stEmail, password = "password123", firstName = "Gate", lastName = "Student" }))
            .Content.ReadFromJsonAsync<AuthBody>();
        Assert.False(st!.emailVerified);

        var stClient = _factory.CreateClient();
        stClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", st.token);
        var blocked = await stClient.PostAsJsonAsync("/api/applications", new { internshipId = listing!.id, coverLetter = (string?)null });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);

        // Verify (via DB, standing in for the emailed link) + refresh the token pair.
        await MarkVerifiedInDb(stEmail);
        var refreshed = await (await client.PostAsJsonAsync("/api/auth/refresh",
            new { refreshToken = st.refreshToken })).Content.ReadFromJsonAsync<AuthBody>();
        Assert.True(refreshed!.emailVerified);

        stClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", refreshed.token);
        var allowed = await stClient.PostAsJsonAsync("/api/applications", new { internshipId = listing.id, coverLetter = "now verified" });
        Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);
    }

    private async Task MarkVerifiedInDb(string email)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LinkerDbContext>();
        await db.Users.Where(u => u.Email == email)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.EmailVerified, true));
    }
}
