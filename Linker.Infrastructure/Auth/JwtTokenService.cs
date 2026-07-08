using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Linker.Application.Common.Interfaces;
using Linker.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Linker.Infrastructure.Auth;

public class JwtTokenService : ITokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string CreateToken(User user)
    {
        var key = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT signing key 'Jwt:Key' is not configured.");

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            // Consumed by the VerifiedEmail authorization policy; refreshed
            // tokens pick up the new value after the user verifies.
            new Claim("email_verified", user.EmailVerified ? "true" : "false")
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        // Short-lived by design; clients stay signed in via refresh-token rotation.
        var minutes = int.TryParse(_configuration["Jwt:AccessTokenMinutes"], out var m) ? m : 15;

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(minutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
