using System.Net;

namespace Linker.Api.RateLimiting;

/// <summary>
/// Resolves the real client IP for rate-limit partitioning when the API sits
/// behind a reverse proxy (nginx in Docker Compose, fly-proxy on Fly.io).
///
/// Forwarded headers are only honoured when the *immediate* connection comes
/// from a configured trusted proxy. Without that check, any direct caller
/// could set its own X-Forwarded-For to evade its rate-limit bucket, or to
/// frame another IP by putting it in the header and flooding that bucket —
/// so an untrusted peer's headers are ignored entirely and its literal
/// connection IP is used instead.
/// </summary>
public static class ClientIpResolver
{
    public static string Resolve(HttpContext context, IReadOnlyList<IPNetwork> trustedProxies)
    {
        var remoteIp = context.Connection.RemoteIpAddress;
        if (remoteIp is null)
        {
            return "unknown";
        }

        if (trustedProxies.Count == 0 || !IsTrusted(remoteIp, trustedProxies))
        {
            return remoteIp.ToString();
        }

        // Fly.io's edge sets this to the true origin client IP directly —
        // more reliable than X-Forwarded-For across Fly's private network hops.
        if (context.Request.Headers.TryGetValue("Fly-Client-IP", out var flyIp) &&
            IPAddress.TryParse(flyIp.ToString(), out var parsedFlyIp))
        {
            return parsedFlyIp.ToString();
        }

        // We trust exactly one hop: the reverse proxy immediately in front of
        // us (nginx in Compose). Its own default directive
        // (proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for)
        // *appends* its observed peer address to whatever X-Forwarded-For the
        // request already had — it does not replace it. That means a client
        // can freely prepend its own fake entries; the one value we can
        // actually trust is always the right-most, since that's the one our
        // proxy itself added. Taking the left-most (the "original client"
        // reading that's correct for a fully-trusted multi-hop chain) would
        // let any direct caller spoof its rate-limit identity by simply
        // sending its own X-Forwarded-For header.
        if (context.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor))
        {
            var parts = forwardedFor.ToString().Split(',');
            var lastHop = parts[^1].Trim();
            if (IPAddress.TryParse(lastHop, out var parsedForwarded))
            {
                return parsedForwarded.ToString();
            }
        }

        return remoteIp.ToString();
    }

    private static bool IsTrusted(IPAddress address, IReadOnlyList<IPNetwork> trustedProxies)
    {
        foreach (var network in trustedProxies)
        {
            if (network.Contains(address))
            {
                return true;
            }
        }
        return false;
    }
}
