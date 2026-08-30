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
    // Fixture passwords must satisfy PasswordPolicy — registration enforces it,
    // so a weak literal here would fail every test for the wrong reason.
    private const string ValidPassword = "Fixture-Pass-1";
    private const string AnotherValidPassword = "Rotated-Pass-2";

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

    /// <summary>
    /// A fresh AuthService bound to a new DbContext scope — mirrors the scoped
    /// DI lifetime a real HTTP request gets, so tests that simulate multiple
    /// requests see committed writes (including bulk ExecuteUpdateAsync calls)
    /// the same way production does, rather than a stale change-tracker copy
    /// held by one long-lived context/service across the whole test.
    /// </summary>
    private AuthService NewRequestScopedService()
    {
        var context = _db.NewContext();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:RefreshTokenDays"] = "30" })
            .Build();

        return new AuthService(
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

    [Fact]
    public async Task RegisterStudent_PersistsUserProfileAndRefreshToken()
    {
        var response = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("s@test.local", ValidPassword, "Ada", "Byte", null, null));

        Assert.Equal("Student", response.Role);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
        Assert.Single(_db.Context.Students);
        Assert.Single(_db.Context.RefreshTokens);
    }

    [Fact]
    public async Task RegisterStudent_DuplicateEmail_ThrowsConflict()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("dup@test.local", ValidPassword, "A", "B", null, null));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterStudentAsync(new RegisterStudentRequest("dup@test.local", ValidPassword, "C", "D", null, null)));
    }

    [Fact]
    public async Task Login_WrongPassword_ThrowsAuthenticationFailed()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("l@test.local", ValidPassword, "A", "B", null, null));

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("l@test.local", "Wrong-Password-99")));
    }

    [Fact]
    public async Task Login_MalformedStoredHash_ThrowsAuthenticationFailed()
    {
        // A stored hash that isn't valid bcrypt (hand-edited row, unhashed
        // import) makes BCrypt.Verify throw; login must still answer 401,
        // not surface a 500.
        await _service.RegisterStudentAsync(new RegisterStudentRequest("bad-hash@test.local", ValidPassword, "A", "B", null, null));
        var user = _db.Context.Users.Single(u => u.Email == "bad-hash@test.local");
        user.PasswordHash = "not-a-bcrypt-hash";
        await _db.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("bad-hash@test.local", ValidPassword)));
    }

    [Fact]
    public async Task Login_CorrectPassword_ReturnsTokens()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("ok@test.local", ValidPassword, "A", "B", null, null));

        var response = await _service.LoginAsync(new LoginRequest("ok@test.local", ValidPassword));

        Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
    }

    [Fact]
    public async Task Refresh_RotatesToken_OldOneNoLongerValid()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("r@test.local", ValidPassword, "A", "B", null, null));

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
            new RegisterStudentRequest("out@test.local", ValidPassword, "A", "B", null, null));

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
    public async Task Refresh_ReplayOfAlreadyRotatedToken_RevokesEntireFamily()
    {
        // Simulates the replay-before-rotation race: an attacker holds a copy of
        // token A (e.g. sniffed off the wire). The legitimate client rotates
        // first (A -> B). The attacker then replays A. Each step below uses a
        // fresh, request-scoped AuthService (matching production's per-request
        // DI scope) so the assertions reflect what a real second/third HTTP
        // request would actually see — not a same-context cache.
        var registered = await NewRequestScopedService().RegisterStudentAsync(
            new RegisterStudentRequest("family@test.local", ValidPassword, "A", "B", null, null));

        // Legitimate client rotates first: token A -> token B.
        var afterFirstRefresh = await NewRequestScopedService().RefreshAsync(new RefreshRequest(registered.RefreshToken));

        // Attacker replays the original token A, which is now revoked —
        // detected as reuse.
        var ex = await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            NewRequestScopedService().RefreshAsync(new RefreshRequest(registered.RefreshToken)));
        Assert.Contains("reused", ex.Message, StringComparison.OrdinalIgnoreCase);

        // The whole family is dead: even the legitimate client's *current*
        // token B — never itself replayed — is now revoked, forcing a full
        // re-login rather than silently trusting a possibly-compromised chain.
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            NewRequestScopedService().RefreshAsync(new RefreshRequest(afterFirstRefresh.RefreshToken)));

        // Confirms it's a real revocation, not just a fluke: the row is present
        // and explicitly marked revoked, not merely absent/expired.
        using var verifyContext = _db.NewContext();
        var tokenRow = verifyContext.RefreshTokens.Single(t => t.TokenHash == Hash(afterFirstRefresh.RefreshToken));
        Assert.NotNull(tokenRow.RevokedAtUtc);
    }

    [Fact]
    public async Task Refresh_UnrelatedFamily_IsNotAffectedByAnotherFamilysReplay()
    {
        var registered = await NewRequestScopedService().RegisterStudentAsync(
            new RegisterStudentRequest("unrelated@test.local", ValidPassword, "A", "B", null, null));

        // A second, independent login (its own family) for the same user —
        // e.g. a second device/browser.
        var secondLogin = await NewRequestScopedService().LoginAsync(new LoginRequest("unrelated@test.local", ValidPassword));

        // Trigger reuse detection on the *first* family only.
        await NewRequestScopedService().RefreshAsync(new RefreshRequest(registered.RefreshToken));
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            NewRequestScopedService().RefreshAsync(new RefreshRequest(registered.RefreshToken)));

        // The second device's session, in a different family, still works.
        var stillWorks = await NewRequestScopedService().RefreshAsync(new RefreshRequest(secondLogin.RefreshToken));
        Assert.False(string.IsNullOrWhiteSpace(stillWorks.Token));
    }

    private static string Hash(string token) =>
        Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));

    [Fact]
    public async Task Register_SendsVerificationEmail_AndUserStartsUnverified()
    {
        var response = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("v@test.local", ValidPassword, "A", "B", null, null));

        Assert.False(response.EmailVerified);
        Assert.Single(_email.Sent);
        Assert.Contains("verify-email?token=", _email.Sent[0].Body);
    }

    [Fact]
    public async Task VerifyEmail_WithEmailedToken_MarksVerified()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("vf@test.local", ValidPassword, "A", "B", null, null));
        var token = ExtractToken(_email.Sent[0].Body, "verify-email?token=");

        await _service.VerifyEmailAsync(new VerifyEmailRequest(token));

        var user = _db.Context.Users.Single(u => u.Email == "vf@test.local");
        Assert.True(user.EmailVerified);
    }

    [Fact]
    public async Task VerifyEmail_ReusedToken_ThrowsBadRequest()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("vr@test.local", ValidPassword, "A", "B", null, null));
        var token = ExtractToken(_email.Sent[0].Body, "verify-email?token=");
        await _service.VerifyEmailAsync(new VerifyEmailRequest(token));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.VerifyEmailAsync(new VerifyEmailRequest(token)));
    }

    [Fact]
    public async Task ForgotThenReset_ChangesPassword_AndOldPasswordFails()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("pw@test.local", ValidPassword, "A", "B", null, null));
        _email.Sent.Clear();

        await _service.ForgotPasswordAsync(new ForgotPasswordRequest("pw@test.local"));
        var token = ExtractToken(_email.Sent[0].Body, "reset-password?token=");
        await _service.ResetPasswordAsync(new ResetPasswordRequest(token, AnotherValidPassword));

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("pw@test.local", ValidPassword)));
        var relogin = await _service.LoginAsync(new LoginRequest("pw@test.local", AnotherValidPassword));
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
    // ---- Lockout ---------------------------------------------------------

    [Fact]
    public async Task Login_AfterTooManyWrongPasswords_LocksTheAccount()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("lock@test.local", ValidPassword, "A", "B", null, null));

        for (var attempt = 0; attempt < User.MaxFailedLoginAttempts; attempt++)
        {
            await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
                _service.LoginAsync(new LoginRequest("lock@test.local", "Wrong-Password-99")));
        }

        // The correct password is now refused too — that's the point of a lockout.
        var ex = await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("lock@test.local", ValidPassword)));
        Assert.Contains("Too many failed", ex.Message);
    }

    [Fact]
    public async Task Login_ASuccessfulSignIn_ClearsTheFailureCount()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("clear@test.local", ValidPassword, "A", "B", null, null));

        // One short of the threshold, then a good password.
        for (var attempt = 0; attempt < User.MaxFailedLoginAttempts - 1; attempt++)
        {
            await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
                _service.LoginAsync(new LoginRequest("clear@test.local", "Wrong-Password-99")));
        }
        await _service.LoginAsync(new LoginRequest("clear@test.local", ValidPassword));

        // A fresh run of failures must start counting from zero, not from four.
        for (var attempt = 0; attempt < User.MaxFailedLoginAttempts - 1; attempt++)
        {
            await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
                _service.LoginAsync(new LoginRequest("clear@test.local", "Wrong-Password-99")));
        }
        var response = await _service.LoginAsync(new LoginRequest("clear@test.local", ValidPassword));
        Assert.NotNull(response.Token);
    }

    [Fact]
    public async Task Login_AnUnknownEmail_IsIndistinguishableFromAWrongPassword()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("known@test.local", ValidPassword, "A", "B", null, null));

        var unknown = await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("nobody@test.local", ValidPassword)));
        var wrong = await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("known@test.local", "Wrong-Password-99")));

        // Same message either way, so login can't be used to enumerate accounts.
        Assert.Equal(wrong.Message, unknown.Message);
    }

    [Fact]
    public async Task ResetPassword_LiftsALockoutCausedByTheAttackersGuesses()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("locked@test.local", ValidPassword, "A", "B", null, null));
        for (var attempt = 0; attempt < User.MaxFailedLoginAttempts; attempt++)
        {
            await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
                _service.LoginAsync(new LoginRequest("locked@test.local", "Wrong-Password-99")));
        }

        _email.Sent.Clear();
        await _service.ForgotPasswordAsync(new ForgotPasswordRequest("locked@test.local"));
        var token = ExtractToken(_email.Sent[0].Body, "reset-password?token=");
        await _service.ResetPasswordAsync(new ResetPasswordRequest(token, AnotherValidPassword));

        // Otherwise the real owner stays shut out by someone else's failures.
        var response = await _service.LoginAsync(new LoginRequest("locked@test.local", AnotherValidPassword));
        Assert.NotNull(response.Token);
    }

    // ---- Change password -------------------------------------------------

    [Fact]
    public async Task ChangePassword_WithTheCurrentPassword_SwapsIt()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("cp@test.local", ValidPassword, "A", "B", null, null));

        await _service.ChangePasswordAsync(registered.UserId, new ChangePasswordRequest(ValidPassword, AnotherValidPassword));

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.LoginAsync(new LoginRequest("cp@test.local", ValidPassword)));
        Assert.NotNull((await _service.LoginAsync(new LoginRequest("cp@test.local", AnotherValidPassword))).Token);
    }

    [Fact]
    public async Task ChangePassword_WithTheWrongCurrentPassword_IsRejected()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("cpw@test.local", ValidPassword, "A", "B", null, null));

        // A stolen access token alone must not be enough to take over the account.
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.ChangePasswordAsync(registered.UserId, new ChangePasswordRequest("Wrong-Password-99", AnotherValidPassword)));
    }

    [Fact]
    public async Task ChangePassword_ToAWeakOne_IsRejected()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("cpweak@test.local", ValidPassword, "A", "B", null, null));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.ChangePasswordAsync(registered.UserId, new ChangePasswordRequest(ValidPassword, "password")));
    }

    [Fact]
    public async Task ChangePassword_ToTheSamePassword_IsRejected()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("cpsame@test.local", ValidPassword, "A", "B", null, null));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.ChangePasswordAsync(registered.UserId, new ChangePasswordRequest(ValidPassword, ValidPassword)));
    }

    [Fact]
    public async Task ChangePassword_RevokesEveryExistingSession()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("cprev@test.local", ValidPassword, "A", "B", null, null));

        await NewRequestScopedService().ChangePasswordAsync(
            registered.UserId, new ChangePasswordRequest(ValidPassword, AnotherValidPassword));

        // If the change was prompted by a compromise, it has to evict the intruder.
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            NewRequestScopedService().RefreshAsync(new RefreshRequest(registered.RefreshToken)));
    }

    // ---- Change email ----------------------------------------------------

    [Fact]
    public async Task ChangeEmail_StagesTheAddress_ButDoesNotApplyItYet()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("old@test.local", ValidPassword, "A", "B", null, null));

        await _service.ChangeEmailAsync(registered.UserId, new ChangeEmailRequest("new@test.local", ValidPassword));

        // The old address still signs in until the new one is confirmed.
        Assert.NotNull((await _service.LoginAsync(new LoginRequest("old@test.local", ValidPassword))).Token);
        var account = await _service.GetAccountAsync(registered.UserId);
        Assert.Equal("new@test.local", account.PendingEmail);
        Assert.Equal("old@test.local", account.Email);
    }

    [Fact]
    public async Task ChangeEmail_NotifiesBothTheOldAndTheNewAddress()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("both-old@test.local", ValidPassword, "A", "B", null, null));
        _email.Sent.Clear();

        await _service.ChangeEmailAsync(registered.UserId, new ChangeEmailRequest("both-new@test.local", ValidPassword));

        // The old inbox is told too, so a hijacked session can't move the account silently.
        Assert.Contains(_email.Sent, m => m.To == "both-new@test.local");
        Assert.Contains(_email.Sent, m => m.To == "both-old@test.local");
    }

    [Fact]
    public async Task ChangeEmail_WithTheWrongPassword_IsRejected()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("ce@test.local", ValidPassword, "A", "B", null, null));

        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            _service.ChangeEmailAsync(registered.UserId, new ChangeEmailRequest("taken@test.local", "Wrong-Password-99")));
    }

    [Fact]
    public async Task ChangeEmail_ToAnAddressAlreadyInUse_ThrowsConflict()
    {
        await _service.RegisterStudentAsync(new RegisterStudentRequest("taken@test.local", ValidPassword, "A", "B", null, null));
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("mover@test.local", ValidPassword, "C", "D", null, null));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.ChangeEmailAsync(registered.UserId, new ChangeEmailRequest("taken@test.local", ValidPassword)));
    }

    [Fact]
    public async Task ConfirmEmailChange_MovesTheLoginIdentity()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("move-old@test.local", ValidPassword, "A", "B", null, null));
        _email.Sent.Clear();
        await _service.ChangeEmailAsync(registered.UserId, new ChangeEmailRequest("move-new@test.local", ValidPassword));
        var token = ExtractToken(_email.Sent.First(m => m.To == "move-new@test.local").Body, "confirm-email-change?token=");

        await NewRequestScopedService().ConfirmEmailChangeAsync(new ConfirmEmailChangeRequest(token));

        var service = NewRequestScopedService();
        Assert.NotNull((await service.LoginAsync(new LoginRequest("move-new@test.local", ValidPassword))).Token);
        await Assert.ThrowsAsync<AuthenticationFailedException>(() =>
            service.LoginAsync(new LoginRequest("move-old@test.local", ValidPassword)));
    }

    [Fact]
    public async Task ConfirmEmailChange_WithAReusedToken_ThrowsBadRequest()
    {
        var registered = await _service.RegisterStudentAsync(
            new RegisterStudentRequest("reuse-old@test.local", ValidPassword, "A", "B", null, null));
        _email.Sent.Clear();
        await _service.ChangeEmailAsync(registered.UserId, new ChangeEmailRequest("reuse-new@test.local", ValidPassword));
        var token = ExtractToken(_email.Sent.First(m => m.To == "reuse-new@test.local").Body, "confirm-email-change?token=");

        await NewRequestScopedService().ConfirmEmailChangeAsync(new ConfirmEmailChangeRequest(token));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            NewRequestScopedService().ConfirmEmailChangeAsync(new ConfirmEmailChangeRequest(token)));
    }

    [Fact]
    public async Task Register_WithAWeakPassword_ThrowsBadRequest()
    {
        await Assert.ThrowsAsync<BadRequestException>(() =>
            _service.RegisterStudentAsync(new RegisterStudentRequest("weak@test.local", "password", "A", "B", null, null)));
    }

    // ---- Forced rotation of legacy passwords ------------------------------

    /// <summary>
    /// Stands in for an account created before the policy existed: the row is
    /// written straight to the DB with a hash of a password registration would
    /// now reject.
    /// </summary>
    private async Task<User> AddLegacyUserAsync(string email, string weakPassword)
    {
        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(weakPassword),
            Role = Linker.Domain.Enums.UserRole.Student,
            CreatedAtUtc = DateTime.UtcNow,
            EmailVerified = true,
            IsActive = true
        };
        _db.Context.Users.Add(user);
        await _db.Context.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task Login_WithAPasswordBelowThePolicy_FlagsTheAccountForRotation()
    {
        await AddLegacyUserAsync("legacy@test.local", "password");

        var response = await _service.LoginAsync(new LoginRequest("legacy@test.local", "password"));

        // The session is real — they need it to reach the change-password call —
        // but confined; the middleware is what enforces that.
        Assert.NotNull(response.Token);
        Assert.True(response.MustChangePassword);
    }

    [Fact]
    public async Task Login_WithACompliantPassword_DoesNotFlagTheAccount()
    {
        await _service.RegisterStudentAsync(
            new RegisterStudentRequest("fine@test.local", ValidPassword, "A", "B", null, null));

        var response = await _service.LoginAsync(new LoginRequest("fine@test.local", ValidPassword));

        // A hash can't be measured against the policy, so flagging wholesale
        // would drag in accounts that were always fine. This one isn't touched.
        Assert.False(response.MustChangePassword);
    }

    [Fact]
    public async Task ChangePassword_ClearsTheRotationFlag()
    {
        var legacy = await AddLegacyUserAsync("rotate@test.local", "password");
        await _service.LoginAsync(new LoginRequest("rotate@test.local", "password"));

        await _service.ChangePasswordAsync(legacy.Id, new ChangePasswordRequest("password", ValidPassword));

        var relogin = await NewRequestScopedService().LoginAsync(
            new LoginRequest("rotate@test.local", ValidPassword));
        Assert.False(relogin.MustChangePassword);
    }

    [Fact]
    public async Task ResetPassword_AlsoClearsTheRotationFlag()
    {
        await AddLegacyUserAsync("rotate-reset@test.local", "password");
        await _service.LoginAsync(new LoginRequest("rotate-reset@test.local", "password"));

        _email.Sent.Clear();
        await _service.ForgotPasswordAsync(new ForgotPasswordRequest("rotate-reset@test.local"));
        var token = ExtractToken(_email.Sent[0].Body, "reset-password?token=");
        await _service.ResetPasswordAsync(new ResetPasswordRequest(token, AnotherValidPassword));

        // Someone locked out of a weak password must be able to escape via reset,
        // not only via the signed-in change form.
        var relogin = await NewRequestScopedService().LoginAsync(
            new LoginRequest("rotate-reset@test.local", AnotherValidPassword));
        Assert.False(relogin.MustChangePassword);
    }

    [Fact]
    public async Task GetAccount_ReportsTheRotationRequirement()
    {
        var legacy = await AddLegacyUserAsync("acct@test.local", "password");
        await _service.LoginAsync(new LoginRequest("acct@test.local", "password"));

        var account = await _service.GetAccountAsync(legacy.Id);

        Assert.True(account.MustChangePassword);
    }

}
