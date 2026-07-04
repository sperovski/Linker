using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Auth;

public record RegisterStudentRequest(
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [MaxLength(200)] string? University,
    [Range(1950, 2100)] int? GraduationYear);

public record RegisterCompanyRequest(
    [Required, EmailAddress, MaxLength(255)] string Email,
    [Required, MinLength(8), MaxLength(100)] string Password,
    [Required, MaxLength(200)] string Name,
    [MaxLength(4000)] string? Description,
    [MaxLength(500), Url] string? Website);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record AuthResponse(int UserId, string Email, string Role, string Token);
