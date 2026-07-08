using Linker.Application.Common.Exceptions;
using Linker.Application.Common.Interfaces;
using Linker.Application.DTOs.Auth;
using Linker.Application.Services;
using Linker.Domain.Entities;
using Linker.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;

namespace Linker.Application.Tests;

public class AuthServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly AuthService _service;
    private readonly FakeEmailSender _email = new();

    private sealed class FakeTokenService : ITokenService
    {
        public string CreateToken(User user) => $"token-for-{user.Id}";
    }

    public AuthServiceTests()
    {
        var context = _db.Context;
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:RefreshTokenDays"] = "30" })
            .Build();

        _service = new AuthService(
            new UserRepository(context),
            new StudentRepository(context),
            new CompanyRepository(context),
            new RefreshTokenRepository(context),
            new UserTokenRepository(context),
            new FakeTokenService(),
            _email,
            context,
            config);
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task RegisterStudent_PersistsUserProfileAndRefreshToken()
    {
        var response = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("s@test.local", "password123", "Ada", "Byte", null, null));

        Assert.Equal("Student", response.Role);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
        Assert.Single(_db.Context.Students);
        Assert.Single(_db.Context.RefreshTokens);
    }

    [Fact]
    public async Task RegisterStudent_DuplicateEmail_ThrowsConflict()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("dup@test.local", "password123", "A", "B", null, null));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterStudentAsync(new RegisterStudentRequest("dup@test.local", "password123", "C", "D", null, null)));
    }

    [Fact]
    public async Task Login_WrongPassword_ThrowsAuthenticationFailed()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("l@test.local", "password123", "A", "B", null, null));

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("l@test.local", "wrongpassword")));
    }

    [Fact]
    public async Task Login_CorrectPassword_ReturnsTokens()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("ok@test.local", "password123", "A", "B", null, null));

        var response = await _service.LoginAsync(new LoginRequest("ok@test.local", "password123"));

        Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
    }

    [Fact]
    public async Task Refresh_RotatesToken_OldOneNoLongerValid()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("r@test.local", "password123", "A", "B", null, null));

        var refreshed = await _service.RefreshAsync(new RefreshRequest(registered.RefreshToken));

        Assert.NotEqual(registered.RefreshToken, refreshed.RefreshToken);
        // The old token is now revoked: reusing it must fail.
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.RefreshAsync(new RefreshRequest(registered.RefreshToken)));
    }

    [Fact]
    public async Task Logout_RevokesToken()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("out@test.local", "password123", "A", "B", null, null));

        await _service.LogoutAsync(new RefreshRequest(registered.RefreshToken));

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.RefreshAsync(new RefreshRequest(registered.RefreshToken)));
    }

    [Fact]
    public async Task Refresh_UnknownToken_ThrowsAuthenticationFailed()
    {
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.RefreshAsync(new RefreshRequest("not-a-real-token")));
    }

    [Fact]
    public async Task Register_SendsVerificationEmail_AndUserStartsUnverified()
    {
        var response = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("v@test.local", "password123", "A", "B", null, null));

        Assert.False(response.EmailVerified);
        Assert.Single(_email.Sent);
        Assert.Contains("verify-email?token=", _email.Sent[0].Body);
    }

    [Fact]
    public async Task VerifyEmail_WithEmailedToken_MarksVerified()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("vf@test.local", "password123", "A", "B", null, null));
        var token = ExtractToken(_email.Sent[0].Body, "verify-email?token=");

        await _service.VerifyEmailAsync(new VerifyEmailRequest(token));

        var user = _db.Context.Users.Single(u => u.Email == "vf@test.local");
        Assert.True(user.EmailVerified);
    }

    [Fact]
    public async Task VerifyEmail_ReusedToken_ThrowsBadRequest()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("vr@test.local", "password123", "A", "B", null, null));
        var token = ExtractToken(_email.Sent[0].Body, "verify-email?token=");
        await _service.VerifyEmailAsync(new VerifyEmailRequest(token));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.VerifyEmailAsync(new VerifyEmailRequest(token)));
    }

    [Fact]
    public async Task ForgotThenReset_ChangesPassword_AndOldPasswordFails()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("pw@test.local", "password123", "A", "B", null, null));
        _email.Sent.Clear();

        await _service.ForgotPasswordAsync(new ForgotPasswordRequest("pw@test.local"));
        var token = ExtractToken(_email.Sent[0].Body, "reset-password?token=");
        await _service.ResetPasswordAsync(new ResetPasswordRequest(token, "newpassword456"));

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("pw@test.local", "password123")));
        var relogin = await _service.LoginAsync(new LoginRequest("pw@test.local", "newpassword456"));
        Assert.False(string.IsNullOrWhiteSpace(relogin.Token));
    }

    [Fact]
    public async Task ForgotPassword_UnknownEmail_DoesNotThrow_AndSendsNothing()
    {
        await _service.ForgotPasswordAsync(new ForgotPasswordRequest("ghost@test.local"));
        Assert.Empty(_email.Sent);
    }

    private static string ExtractToken(string body, string marker)
    {
        var start = body.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
        var end = body.IndexOf('"', start);
        return Uri.UnescapeDataString(body[start..end]);
    }
}
