using System.Net;
using Linker.Api.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace Linker.Api.IntegrationTests;

public class ClientIpResolverTests
{
    private static IPNetwork Net(string cidr) => IPNetwork.Parse(cidr);

    [Fact]
    public void UntrustedDirectConnection_IgnoresForwardedHeader()
    {
        // A caller hitting the API directly (bypassing any proxy) could set its
        // own X-Forwarded-For to dodge its rate-limit bucket, or to frame
        // another IP by flooding it — so an untrusted peer's headers must
        // never be honoured.
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.9");
        context.Request.Headers["X-Forwarded-For"] = "1.2.3.4";

        var result = ClientIpResolver.Resolve(context, [Net("172.16.0.0/12")]);

        Assert.Equal("203.0.113.9", result);
    }

    [Fact]
    public void TrustedProxy_SingleHop_UsesTheOnlyEntry()
    {
        // The normal case: nginx (inside the compose bridge network) sees the
        // real client directly and produces a single-entry XFF (its own
        // $remote_addr, no pre-existing header to append to).
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("172.21.0.5");
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.9";

        var result = ClientIpResolver.Resolve(context, [Net("172.16.0.0/12")]);

        Assert.Equal("203.0.113.9", result);
    }

    [Fact]
    public void TrustedProxy_ClientPrependsSpoofedEntry_UsesProxysOwnAppendedHopInstead()
    {
        // nginx's default directive (proxy_set_header X-Forwarded-For
        // $proxy_add_x_forwarded_for) *appends* to any header the caller
        // already sent rather than replacing it — so a malicious caller can
        // freely prepend a fake IP. The right-most entry is always the one
        // nginx itself added and is the only one that can be trusted; the
        // spoofed left-most entry must be ignored.
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("172.21.0.5");
        context.Request.Headers["X-Forwarded-For"] = "6.6.6.6, 203.0.113.9";

        var result = ClientIpResolver.Resolve(context, [Net("172.16.0.0/12")]);

        Assert.Equal("203.0.113.9", result);
        Assert.NotEqual("6.6.6.6", result);
    }

    [Fact]
    public void TrustedProxy_PrefersFlyClientIpHeaderOverForwardedFor()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("fdaa::1");
        context.Request.Headers["Fly-Client-IP"] = "198.51.100.7";
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.9";

        var result = ClientIpResolver.Resolve(context, [Net("fdaa::/16")]);

        Assert.Equal("198.51.100.7", result);
    }

    [Fact]
    public void NoTrustedProxiesConfigured_AlwaysUsesDirectConnectionIp()
    {
        // Matches plain `dotnet run` (no proxy in front): the empty list is the
        // documented default in appsettings.json.
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Loopback;
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.9";

        var result = ClientIpResolver.Resolve(context, []);

        Assert.Equal("127.0.0.1", result);
    }

    [Fact]
    public void TrustedProxy_MalformedForwardedHeader_FallsBackToConnectionIp()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("172.21.0.5");
        context.Request.Headers["X-Forwarded-For"] = "not-an-ip-address";

        var result = ClientIpResolver.Resolve(context, [Net("172.16.0.0/12")]);

        Assert.Equal("172.21.0.5", result);
    }

    [Fact]
    public void ProxyOutsideTrustedRange_IsTreatedAsUntrusted()
    {
        // A network address that happens to be adjacent to, but not inside,
        // the trusted CIDR must not be treated as trusted.
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("172.32.0.1"); // just outside 172.16.0.0/12
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.9";

        var result = ClientIpResolver.Resolve(context, [Net("172.16.0.0/12")]);

        Assert.Equal("172.32.0.1", result);
    }
}
