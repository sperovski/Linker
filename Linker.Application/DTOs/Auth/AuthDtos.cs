using System.ComponentModel.DataAnnotations;
using Linker.Application.Common.Validation;

namespace Linker.Application.DTOs.Auth;

public record RegisterStudentRequest(
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, StrongPassword] string Password,
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [MaxLength(200)] string? University,
    [CurrentYearOrLater] int? GraduationYear);

public record RegisterCompanyRequest(
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, StrongPassword] string Password,
    [Required, MaxLength(200)] string Name,
    [MaxLength(4000)] string? Description,
    [MaxLength(500), Url] string? Website);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record RefreshRequest([Required] string RefreshToken);

public record VerifyEmailRequest([Required] string Token);

public record ResendVerificationRequest([Required, EmailAddress] string Email);

public record ForgotPasswordRequest([Required, EmailAddress] string Email);

public record ResetPasswordRequest(
    [Required] string Token,
    [Required, StrongPassword] string NewPassword);

public record AuthResponse(
    int UserId,
    string Email,
    string Role,
    string Token,
    string RefreshToken,
    bool EmailVerified,
    /// <summary>
    /// True when this account's password no longer meets the policy. The session
    /// is real but confined: until a new password is set, the API refuses
    /// everything except reading the account and changing it.
    /// </summary>
    bool MustChangePassword);

/// <summary>
/// Changing a password requires proving possession of the current one, so a
/// stolen access token alone cannot lock the real owner out of their account.
/// </summary>
public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, StrongPassword] string NewPassword);

/// <summary>
/// Changing the login email also requires the current password. The new address
/// is only staged until it is confirmed from the inbox that claims it.
/// </summary>
public record ChangeEmailRequest(
    [Required, EmailAddress, MaxLength(255)] string NewEmail,
    [Required] string CurrentPassword);

public record ConfirmEmailChangeRequest([Required] string Token);

/// <summary>The signed-in account as its owner sees it, for the settings page.</summary>
public record AccountResponse(
    int UserId,
    string Email,
    string Role,
    bool EmailVerified,
    string? PendingEmail,
    DateTime CreatedAtUtc,
    bool MustChangePassword);
