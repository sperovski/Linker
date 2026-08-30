namespace Linker.Application.Common.Validation;

/// <summary>
/// The single definition of what counts as an acceptable password. Registration,
/// password reset and password change all route through <see cref="Validate"/>,
/// so the rule can never drift between the three entry points, and the frontend
/// meter mirrors these same thresholds.
///
/// The blocklist is deliberately small and targets what people actually pick on a
/// student/company job board — it is a speed bump against the top guesses, not a
/// substitute for the rate limiting and lockout that guard the login endpoint.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 10;
    public const int MaxLength = 100;

    /// <summary>How many of {lowercase, uppercase, digit, symbol} a password must span.</summary>
    private const int RequiredCharacterClasses = 3;

    private static readonly HashSet<string> Blocklist = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "password1", "password123", "passw0rd", "p@ssw0rd", "p@ssword1",
        "12345678", "123456789", "1234567890", "qwertyuiop", "qwerty123", "1q2w3e4r",
        "letmein123", "welcome123", "admin12345", "administrator", "iloveyou1",
        "linkerlinker", "linker1234", "internship", "internship1", "studentpass",
        "changeme123", "secret1234", "trustno1234", "monkey12345", "dragon12345",
    };

    /// <summary>
    /// Returns null when the password is acceptable, otherwise a message safe to
    /// show the user. The message names the failed rule but never echoes the
    /// password back.
    /// </summary>
    public static string? Validate(string? password, string? email = null)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return "A password is required.";
        }

        if (password.Length < MinLength)
        {
            return $"Password must be at least {MinLength} characters.";
        }

        if (password.Length > MaxLength)
        {
            return $"Password cannot exceed {MaxLength} characters.";
        }

        if (password.Any(char.IsWhiteSpace) && password.Trim().Length != password.Length)
        {
            return "Password cannot start or end with a space.";
        }

        // Shape checks run before the character-class rule so that "aaaaaaaaaa"
        // and "abcdefghij" are told what's actually wrong with them, rather than
        // being sent off to add a digit to a password that stays guessable.
        if (Blocklist.Contains(password))
        {
            return "That password is too common. Pick something less predictable.";
        }

        if (IsSingleRepeatedCharacter(password) || IsSequential(password))
        {
            return "Password is too predictable. Avoid repeated or sequential characters.";
        }

        if (CountCharacterClasses(password) < RequiredCharacterClasses)
        {
            return "Password must combine at least three of: lowercase letters, uppercase letters, numbers, symbols.";
        }

        // A password built from the account's own email is guessable by anyone
        // who knows the address — which, for a login, is everyone.
        var localPart = email?.Split('@').FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(localPart) && localPart.Length >= 4 &&
            password.Contains(localPart, StringComparison.OrdinalIgnoreCase))
        {
            return "Password cannot contain your email address.";
        }

        return null;
    }

    public static int CountCharacterClasses(string password)
    {
        var classes = 0;
        if (password.Any(char.IsLower)) classes++;
        if (password.Any(char.IsUpper)) classes++;
        if (password.Any(char.IsDigit)) classes++;
        if (password.Any(c => !char.IsLetterOrDigit(c))) classes++;
        return classes;
    }

    private static bool IsSingleRepeatedCharacter(string password) =>
        password.Distinct().Count() == 1;

    /// <summary>True when the whole password is one run of ascending or descending characters ("abcdefghij", "9876543210").</summary>
    private static bool IsSequential(string password)
    {
        if (password.Length < 4)
        {
            return false;
        }

        var ascending = true;
        var descending = true;
        for (var i = 1; i < password.Length; i++)
        {
            var delta = password[i] - password[i - 1];
            if (delta != 1) ascending = false;
            if (delta != -1) descending = false;
        }
        return ascending || descending;
    }
}
