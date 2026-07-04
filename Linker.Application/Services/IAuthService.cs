using Linker.Application.DTOs.Auth;

namespace Linker.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterStudentAsync(RegisterStudentRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> RegisterCompanyAsync(RegisterCompanyRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
}
