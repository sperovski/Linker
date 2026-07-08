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
}
