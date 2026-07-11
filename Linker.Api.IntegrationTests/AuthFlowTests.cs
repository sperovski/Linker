using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Linker.Api.IntegrationTests;

public class AuthFlowTests : IClassFixture<LinkerApiFactory>
{
    private readonly LinkerApiFactory _factory;

    public AuthFlowTests(LinkerApiFactory factory) => _factory = factory;

    private static object StudentPayload(string email) => new
    {
        email,
        password = "password123",
        firstName = "Test",
        lastName = "User"
    };

    private record AuthBody(int userId, string email, string role, string token, string refreshToken);

    [Fact]
    public async Task Register_ReturnsTokenPair_AndProfileIsAccessible()
    {
        var client = _factory.CreateClient();
        var email = $"reg-{Guid.NewGuid():N}@test.local";

        var register = await client.PostAsJsonAsync("/api/auth/register/student", StudentPayload(email));
        Assert.Equal(HttpStatusCode.Created, register.StatusCode);

        var body = await register.Content.ReadFromJsonAsync<AuthBody>();
        Assert.NotNull(body);
        Assert.False(string.IsNullOrWhiteSpace(body!.token));
        Assert.False(string.IsNullOrWhiteSpace(body.refreshToken));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.token);
        var me = await client.GetAsync("/api/students/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/students/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task StudentToken_OnCompanyEndpoint_Returns403()
    {
        var client = _factory.CreateClient();
        var email = $"role-{Guid.NewGuid():N}@test.local";
        var register = await client.PostAsJsonAsync("/api/auth/register/student", StudentPayload(email));
        var body = await register.Content.ReadFromJsonAsync<AuthBody>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.token);
        // Company-only endpoint.
        var response = await client.GetAsync("/api/companies/dashboard");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_Rotates_AndReuseIsRejected()
    {
        var client = _factory.CreateClient();
        var email = $"rot-{Guid.NewGuid():N}@test.local";
        var register = await client.PostAsJsonAsync("/api/auth/register/student", StudentPayload(email));
        var body = await register.Content.ReadFromJsonAsync<AuthBody>();

        var refresh = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = body!.refreshToken });
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
        var refreshed = await refresh.Content.ReadFromJsonAsync<AuthBody>();
        Assert.NotEqual(body.refreshToken, refreshed!.refreshToken);

        // Old token was single-use — replaying it is rejected...
        var reuse = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = body.refreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);

        // ...and the replay revokes the whole family: the *current*, never-reused
        // token is now dead too, forcing a full re-login rather than trusting a
        // chain that may have been compromised.
        var reuseOfCurrent = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = refreshed.refreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, reuseOfCurrent.StatusCode);
    }

    [Fact]
    public async Task ApplyWithdrawReapply_FullFlow()
    {
        var client = _factory.CreateClient();

        // Company posts a listing.
        var companyEmail = $"co-{Guid.NewGuid():N}@test.local";
        var companyReg = await client.PostAsJsonAsync("/api/auth/register/company", new
        {
            email = companyEmail,
            password = "password123",
            name = "Flow Co"
        });
        var company = await companyReg.Content.ReadFromJsonAsync<AuthBody>();

        var companyClient = _factory.CreateClient();
        companyClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", company!.token);
        var create = await companyClient.PostAsJsonAsync("/api/internships", new
        {
            title = "Flow Intern",
            description = "A role to exercise the apply flow end to end.",
            location = "Skopje",
            type = "Internship",
            skillIds = Array.Empty<int>()
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var listing = await create.Content.ReadFromJsonAsync<InternshipDetail>();

        // Student applies.
        var studentEmail = $"st-{Guid.NewGuid():N}@test.local";
        var studentReg = await client.PostAsJsonAsync("/api/auth/register/student", StudentPayload(studentEmail));
        var student = await studentReg.Content.ReadFromJsonAsync<AuthBody>();
        var studentClient = _factory.CreateClient();
        studentClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", student!.token);

        var apply = await studentClient.PostAsJsonAsync("/api/applications", new { internshipId = listing!.id, coverNote = "first" });
        Assert.Equal(HttpStatusCode.Created, apply.StatusCode);
        var application = await apply.Content.ReadFromJsonAsync<ApplicationBody>();

        // Duplicate apply is rejected.
        var duplicate = await studentClient.PostAsJsonAsync("/api/applications", new { internshipId = listing.id, coverNote = "dupe" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        // Withdraw, then re-apply reactivates.
        var withdraw = await studentClient.PostAsync($"/api/applications/{application!.id}/withdraw", null);
        Assert.Equal(HttpStatusCode.OK, withdraw.StatusCode);

        var reapply = await studentClient.PostAsJsonAsync("/api/applications", new { internshipId = listing.id, coverNote = "second" });
        Assert.Equal(HttpStatusCode.Created, reapply.StatusCode);
        var reapplied = await reapply.Content.ReadFromJsonAsync<ApplicationBody>();
        Assert.Equal(application.id, reapplied!.id);
        Assert.Equal("Submitted", reapplied.status);
    }

    private record InternshipDetail(int id, string title);
    private record ApplicationBody(int id, string status);
}
