using System.Security.Cryptography;
using System.Text;
using Linker.Application.Common.Exceptions;
using Linker.Application.Common.Interfaces;
using Linker.Application.DTOs.Auth;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;
using Microsoft.Extensions.Configuration;

namespace Linker.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IStudentRepository _studentRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IUserTokenRepository _userTokenRepository;
    private readonly ITokenService _tokenService;
    private readonly IEmailSender _emailSender;
    private readonly IUnitOfWork _unitOfWork;
    private readonly int _refreshTokenDays;
    private readonly int _verificationTokenHours;
    private readonly int _resetTokenHours;
    private readonly string _appBaseUrl;

    public AuthService(
        IUserRepository userRepository,
        IStudentRepository studentRepository,
        ICompanyRepository companyRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IUserTokenRepository userTokenRepository,
        ITokenService tokenService,
        IEmailSender emailSender,
        IUnitOfWork unitOfWork,
        IConfiguration configuration)
    {
        _userRepository = userRepository;
        _studentRepository = studentRepository;
        _companyRepository = companyRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _userTokenRepository = userTokenRepository;
        _tokenService = tokenService;
        _emailSender = emailSender;
        _unitOfWork = unitOfWork;
        _refreshTokenDays = int.TryParse(configuration["Jwt:RefreshTokenDays"], out var days) ? days : 30;
        _verificationTokenHours = int.TryParse(configuration["Auth:VerificationTokenHours"], out var v) ? v : 48;
        _resetTokenHours = int.TryParse(configuration["Auth:ResetTokenHours"], out var r) ? r : 2;
        _appBaseUrl = (configuration["App:BaseUrl"] ?? "http://localhost:4200").TrimEnd('/');
    }

    public async Task<AuthResponse> RegisterStudentAsync(RegisterStudentRequest request, CancellationToken cancellationToken = default)
    {
        var user = await BuildUserAsync(request.Email, request.Password, UserRole.Student, cancellationToken);

        // Linked via navigation so user + profile + session commit as one unit.
        _studentRepository.Add(new Student
        {
            User = user,
            FirstName = request.FirstName,
            LastName = request.LastName,
            University = request.University,
            GraduationYear = request.GraduationYear
        });

        var rawRefreshToken = StageRefreshToken(user);
        var rawVerification = StageUserToken(user, UserTokenPurpose.EmailVerification, _verificationTokenHours);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await SendVerificationEmailAsync(user.Email, rawVerification, cancellationToken);
        return ToAuthResponse(user, rawRefreshToken);
    }

    public async Task<AuthResponse> RegisterCompanyAsync(RegisterCompanyRequest request, CancellationToken cancellationToken = default)
    {
        var user = await BuildUserAsync(request.Email, request.Password, UserRole.Company, cancellationToken);

        _companyRepository.Add(new Company
        {
            User = user,
            Name = request.Name,
            Description = request.Description,
            Website = request.Website
        });

        var rawRefreshToken = StageRefreshToken(user);
        var rawVerification = StageUserToken(user, UserTokenPurpose.EmailVerification, _verificationTokenHours);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await SendVerificationEmailAsync(user.Email, rawVerification, cancellationToken);
        return ToAuthResponse(user, rawRefreshToken);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new AuthenticationFailedException("Invalid email or password.");
        }

        if (!user.IsActive)
        {
            throw new AuthenticationFailedException("This account has been disabled. Contact support if you think this is a mistake.");
        }

        var rawRefreshToken = StageRefreshToken(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return ToAuthResponse(user, rawRefreshToken);
    }

    public async Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken = default)
    {
        var stored = await _refreshTokenRepository.GetByTokenHashAsync(Hash(request.RefreshToken), cancellationToken);
        if (stored is null)
        {
            throw new AuthenticationFailedException("Invalid or expired refresh token.");
        }

        if (stored.RevokedAtUtc is not null)
        {
            // This exact token was already rotated away, yet it's being presented
            // again — either a stolen/leaked copy or a client retry race. Either
            // way, treat it as compromised: kill every token descended from this
            // login so both the attacker and the legitimate client must
            // re-authenticate, rather than failing just this one request.
            await _refreshTokenRepository.RevokeFamilyAsync(stored.FamilyId, cancellationToken);
            throw new AuthenticationFailedException(
                "This session was revoked because a refresh token was reused. Please log in again.");
        }

        if (stored.ExpiresAtUtc <= DateTime.UtcNow || !stored.User.IsActive)
        {
            // Naturally expired or the account was disabled — not a replay, so
            // the rest of the family is left alone.
            throw new AuthenticationFailedException("Invalid or expired refresh token.");
        }

        // Rotation: every refresh token is single-use; revoke + reissue
        // atomically, keeping the same family so a later replay is still
        // detectable against this new token too.
        stored.RevokedAtUtc = DateTime.UtcNow;
        var rawRefreshToken = StageRefreshToken(stored.User, stored.FamilyId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return ToAuthResponse(stored.User, rawRefreshToken);
    }

    public async Task LogoutAsync(RefreshRequest request, CancellationToken cancellationToken = default)
    {
        var stored = await _refreshTokenRepository.GetByTokenHashAsync(Hash(request.RefreshToken), cancellationToken);
        if (stored is not null && stored.IsActive)
        {
            stored.RevokedAtUtc = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        // Unknown/already-revoked tokens are a no-op: logout is idempotent.
    }

    public async Task<bool> VerifyEmailAsync(VerifyEmailRequest request, CancellationToken cancellationToken = default)
    {
        var token = await _userTokenRepository.GetUsableAsync(Hash(request.Token), UserTokenPurpose.EmailVerification, cancellationToken);
        if (token is null || !token.IsUsable)
        {
            throw new BadRequestException("This verification link is invalid or has expired.");
        }

        token.UsedAtUtc = DateTime.UtcNow;
        token.User.EmailVerified = true;
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task ResendVerificationAsync(ResendVerificationRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (user is not null && !user.EmailVerified && user.IsActive)
        {
            await _userTokenRepository.InvalidateExistingAsync(user.Id, UserTokenPurpose.EmailVerification, cancellationToken);
            var raw = StageUserToken(user, UserTokenPurpose.EmailVerification, _verificationTokenHours);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await SendVerificationEmailAsync(user.Email, raw, cancellationToken);
        }
        // Always succeed outwardly regardless of whether the account exists.
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (user is not null && user.IsActive)
        {
            await _userTokenRepository.InvalidateExistingAsync(user.Id, UserTokenPurpose.PasswordReset, cancellationToken);
            var raw = StageUserToken(user, UserTokenPurpose.PasswordReset, _resetTokenHours);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var link = $"{_appBaseUrl}/reset-password?token={Uri.EscapeDataString(raw)}";
            await _emailSender.SendAsync(user.Email, "Reset your Linker password",
                $"<p>We received a request to reset your password. This link expires in {_resetTokenHours} hours:</p>" +
                $"<p><a href=\"{link}\">Reset your password</a></p>" +
                "<p>If you didn't request this, you can safely ignore this email.</p>",
                cancellationToken);
        }
        // Always 200 outwardly: never reveal whether an email is registered.
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var token = await _userTokenRepository.GetUsableAsync(Hash(request.Token), UserTokenPurpose.PasswordReset, cancellationToken);
        if (token is null || !token.IsUsable)
        {
            throw new BadRequestException("This reset link is invalid or has expired.");
        }

        token.UsedAtUtc = DateTime.UtcNow;
        token.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        // A password change invalidates all existing sessions.
        await _refreshTokenRepository.RevokeAllForUserAsync(token.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<User> BuildUserAsync(string email, string password, UserRole role, CancellationToken cancellationToken)
    {
        if (await _userRepository.EmailExistsAsync(email, cancellationToken))
        {
            throw new ConflictException($"An account with email '{email}' already exists.");
        }

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = role,
            CreatedAtUtc = DateTime.UtcNow,
            EmailVerified = false,
            IsActive = true
        };
        _userRepository.Add(user);

        return user;
    }

    private async Task SendVerificationEmailAsync(string email, string rawToken, CancellationToken cancellationToken)
    {
        var link = $"{_appBaseUrl}/verify-email?token={Uri.EscapeDataString(rawToken)}";
        await _emailSender.SendAsync(email, "Verify your Linker email",
            "<p>Welcome to Linker! Confirm your email address to unlock everything:</p>" +
            $"<p><a href=\"{link}\">Verify my email</a></p>" +
            $"<p>This link expires in {_verificationTokenHours} hours.</p>",
            cancellationToken);
    }

    /// <summary>
    /// Stages a new refresh token for the user and returns the raw value.
    /// Omit <paramref name="familyId"/> to start a fresh lineage (login/register);
    /// pass the rotating token's family to keep it (refresh), so a later replay
    /// of any token in the chain is still attributable to the same session.
    /// </summary>
    private string StageRefreshToken(User user, Guid? familyId = null)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        _refreshTokenRepository.Add(new RefreshToken
        {
            User = user,
            TokenHash = Hash(raw),
            FamilyId = familyId ?? Guid.NewGuid(),
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_refreshTokenDays)
        });
        return raw;
    }

    /// <summary>Stages a single-use verification/reset token and returns the raw value.</summary>
    private string StageUserToken(User user, UserTokenPurpose purpose, int expiresInHours)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        _userTokenRepository.Add(new UserToken
        {
            User = user,
            Purpose = purpose,
            TokenHash = Hash(raw),
            ExpiresAtUtc = DateTime.UtcNow.AddHours(expiresInHours)
        });
        return raw;
    }

    private AuthResponse ToAuthResponse(User user, string rawRefreshToken) =>
        new(user.Id, user.Email, user.Role.ToString(), _tokenService.CreateToken(user), rawRefreshToken, user.EmailVerified);

    private static string Hash(string token) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
