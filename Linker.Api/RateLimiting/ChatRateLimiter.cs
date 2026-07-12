using System.Threading.RateLimiting;

namespace Linker.Api.RateLimiting;

/// <summary>
/// Per-user message rate limit for the SignalR hub. The ASP.NET Core rate-limiting
/// middleware only guards the initial HTTP handshake, not individual hub method
/// calls over the open socket — so message-flood protection has to be enforced
/// inside the hub, which this provides. Same System.Threading.RateLimiting
/// primitive Program.cs uses for the HTTP endpoints; registered as a singleton so
/// the window is shared across every connection a user has.
/// </summary>
public interface IChatRateLimiter
{
    RateLimitLease Acquire(int userId);
}

public sealed class ChatRateLimiter : IChatRateLimiter, IDisposable
{
    // ~10 messages per 10s per user. Bursty enough for real conversation, far
    // below what a flood/spam script needs.
    private readonly PartitionedRateLimiter<int> _limiter =
        PartitionedRateLimiter.Create<int, int>(userId =>
            RateLimitPartition.GetFixedWindowLimiter(userId, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromSeconds(10),
                QueueLimit = 0,
            }));

    public RateLimitLease Acquire(int userId) => _limiter.AttemptAcquire(userId);

    public void Dispose() => _limiter.Dispose();
}
