using Linker.Application.DTOs.Auth;

namespace Linker.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterStudentAsync(RegisterStudentRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> RegisterCompanyAsync(RegisterCompanyRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(RefreshRequest request, CancellationToken cancellationToken = default);
    Task<bool> VerifyEmailAsync(VerifyEmailRequest request, CancellationToken cancellationToken = default);
    Task ResendVerificationAsync(ResendVerificationRequest request, CancellationToken cancellationToken = default);
    Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);

    /// <summary>Signed-in password change; requires the current password and revokes every session.</summary>
    Task ChangePasswordAsync(int userId, ChangePasswordRequest request, CancellationToken cancellationToken = default);

    /// <summary>Stages a new login email and mails a confirmation link to it; the change is not applied yet.</summary>
    Task ChangeEmailAsync(int userId, ChangeEmailRequest request, CancellationToken cancellationToken = default);

    /// <summary>Applies a staged email change once the link sent to the new address is used.</summary>
    Task ConfirmEmailChangeAsync(ConfirmEmailChangeRequest request, CancellationToken cancellationToken = default);

    Task<AccountResponse> GetAccountAsync(int userId, CancellationToken cancellationToken = default);
}
