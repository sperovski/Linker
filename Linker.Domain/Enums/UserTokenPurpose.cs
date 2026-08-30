namespace Linker.Domain.Enums;

public enum UserTokenPurpose
{
    EmailVerification = 0,
    PasswordReset = 1,
    /// <summary>Confirms a requested change of the account's login email.</summary>
    EmailChange = 2
}
