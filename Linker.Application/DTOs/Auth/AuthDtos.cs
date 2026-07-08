using System.ComponentModel.DataAnnotations;
using Linker.Application.Common.Validation;

namespace Linker.Application.DTOs.Auth;

public record RegisterStudentRequest(
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [MaxLength(200)] string? University,
    [CurrentYearOrLater] int? GraduationYear);

public record RegisterCompanyRequest(
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, MinLength(8), MaxLength(100)] string Password,
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
    [Required, MinLength(8), MaxLength(100)] string NewPassword);

public record AuthResponse(
    int UserId,
    string Email,
    string Role,
    string Token,
    string RefreshToken,
    bool EmailVerified);
