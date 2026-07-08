using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;

namespace Linker.Api.IntegrationTests;

/// <summary>Own factory with a tiny auth budget so the limiter is provable in isolation.</summary>
public class RateLimitedApiFactory : LinkerApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("RateLimiting:AuthPerMinute", "5");
    }
}

public class RateLimitTests : IClassFixture<RateLimitedApiFactory>
{
    private readonly RateLimitedApiFactory _factory;

    public RateLimitTests(RateLimitedApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Login_ExceedingRateLimit_Returns429()
    {
        var client = _factory.CreateClient();
        var payload = new { email = "nobody@test.local", password = "wrongpassword" };

        HttpStatusCode? sawTooMany = null;
        // Budget is 5/min here; 12 attempts must trip the limiter.
        for (var i = 0; i < 12; i++)
        {
            var response = await client.PostAsJsonAsync("/api/auth/login", payload);
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                sawTooMany = response.StatusCode;
                break;
            }
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, sawTooMany);
    }
}
