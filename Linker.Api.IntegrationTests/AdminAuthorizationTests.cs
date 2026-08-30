using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Linker.Api.IntegrationTests;

/// <summary>
/// AdminController is a real security boundary: every endpoint must reject
/// anonymous callers (401) and authenticated non-admins (403).
/// </summary>
public class AdminAuthorizationTests : IClassFixture<LinkerApiFactory>
{
    private readonly LinkerApiFactory _factory;

    public AdminAuthorizationTests(LinkerApiFactory factory) => _factory = factory;

    private record AuthBody(int userId, string email, string role, string token, string refreshToken);

    public static TheoryData<HttpMethod, string> AdminEndpoints => new()
    {
        { HttpMethod.Get, "/api/admin/stats" },
        { HttpMethod.Get, "/api/admin/users" },
        { HttpMethod.Get, "/api/admin/internships" },
        { HttpMethod.Post, "/api/admin/users/1/active" },
    };

    [Theory]
    [MemberData(nameof(AdminEndpoints))]
    public async Task AdminEndpoint_WithoutToken_Returns401(HttpMethod method, string url)
    {
        var client = _factory.CreateClient();

        var response = await client.SendAsync(Request(method, url));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(AdminEndpoints))]
    public async Task AdminEndpoint_WithStudentToken_Returns403(HttpMethod method, string url)
    {
        var client = _factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/auth/register/student", new
        {
            email = $"adm-{Guid.NewGuid():N}@test.local",
            password = "Fixture-Pass-1",
            firstName = "Not",
            lastName = "Admin"
        });
        var body = await register.Content.ReadFromJsonAsync<AuthBody>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.token);

        var response = await client.SendAsync(Request(method, url));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static HttpRequestMessage Request(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        if (method == HttpMethod.Post)
        {
            request.Content = JsonContent.Create(new { isActive = false });
        }
        return request;
    }
}
