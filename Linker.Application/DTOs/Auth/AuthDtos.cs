namespace Linker.Application.DTOs.Auth;

public record RegisterStudentRequest(
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string? University,
    int? GraduationYear);

public record RegisterCompanyRequest(
    string Email,
    string Password,
    string Name,
    string? Description,
    string? Website);

public record LoginRequest(string Email, string Password);

public record AuthResponse(int UserId, string Email, string Role, string Token);
