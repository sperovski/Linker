using Linker.Domain.Enums;

namespace Linker.Domain.Entities;

public class User
{
    /// <summary>Failed logins tolerated before the account is temporarily locked.</summary>
    public const int MaxFailedLoginAttempts = 5;

    /// <summary>How long a lockout lasts once <see cref="MaxFailedLoginAttempts"/> is hit.</summary>
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public int Id { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public UserRole Role { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public bool EmailVerified { get; set; }

    /// <summary>Admins can disable an account; disabled users cannot authenticate.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Address requested via "change email", held here until the owner clicks the
    /// confirmation link. <see cref="Email"/> — the actual login identity — only
    /// moves once that link is used, so a typo or a hijacked session can never
    /// strand the account on an address nobody controls.
    /// </summary>
    public string? PendingEmail { get; set; }

    /// <summary>Consecutive failed password attempts; reset to 0 on any successful login.</summary>
    public int FailedLoginAttempts { get; set; }

    /// <summary>When set and in the future, login is refused regardless of the password.</summary>
    public DateTime? LockoutEndUtc { get; set; }

    /// <summary>
    /// Set when a sign-in proves the account's password no longer meets
    /// <c>PasswordPolicy</c> — an account created before the policy existed, or
    /// under an older one. The account keeps working only far enough to choose a
    /// new password; everything else is refused until it does.
    ///
    /// This is decided at login because that is the only moment the plaintext is
    /// in hand: a stored bcrypt hash cannot be tested against the policy, so
    /// flagging accounts wholesale would force a change on people whose password
    /// was already fine.
    /// </summary>
    public bool MustChangePassword { get; set; }

    public Student? Student { get; set; }
    public Company? Company { get; set; }

    public bool IsLockedOut(DateTime utcNow) => LockoutEndUtc is not null && LockoutEndUtc > utcNow;

    /// <summary>
    /// Records a failed password attempt, locking the account once the threshold
    /// is reached. Counting happens on the user row rather than per-IP so an
    /// attacker cannot dodge it by rotating source addresses.
    /// </summary>
    public void RegisterFailedLogin(DateTime utcNow)
    {
        FailedLoginAttempts++;
        if (FailedLoginAttempts >= MaxFailedLoginAttempts)
        {
            LockoutEndUtc = utcNow.Add(LockoutDuration);
            FailedLoginAttempts = 0;
        }
    }

    /// <summary>Clears the failure counter and any expired lockout after a good password.</summary>
    public void RegisterSuccessfulLogin()
    {
        FailedLoginAttempts = 0;
        LockoutEndUtc = null;
    }
}
