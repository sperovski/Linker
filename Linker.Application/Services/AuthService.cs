using Linker.Application.Common.Exceptions;
using Linker.Application.Common.Interfaces;
using Linker.Application.DTOs.Auth;
using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IStudentRepository _studentRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly ITokenService _tokenService;

    public AuthService(
        IUserRepository userRepository,
        IStudentRepository studentRepository,
        ICompanyRepository companyRepository,
        ITokenService tokenService)
    {
        _userRepository = userRepository;
        _studentRepository = studentRepository;
        _companyRepository = companyRepository;
        _tokenService = tokenService;
    }

    public async Task<AuthResponse> RegisterStudentAsync(RegisterStudentRequest request, CancellationToken cancellationToken = default)
    {
        var user = await CreateUserAsync(request.Email, request.Password, UserRole.Student, cancellationToken);

        var student = new Student
        {
            UserId = user.Id,
            FirstName = request.FirstName,
            LastName = request.LastName,
            University = request.University,
            GraduationYear = request.GraduationYear
        };
        await _studentRepository.AddAsync(student, cancellationToken);

        return ToAuthResponse(user);
    }

    public async Task<AuthResponse> RegisterCompanyAsync(RegisterCompanyRequest request, CancellationToken cancellationToken = default)
    {
        var user = await CreateUserAsync(request.Email, request.Password, UserRole.Company, cancellationToken);

        var company = new Company
        {
            UserId = user.Id,
            Name = request.Name,
            Description = request.Description,
            Website = request.Website
        };
        await _companyRepository.AddAsync(company, cancellationToken);

        return ToAuthResponse(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            throw new AuthenticationFailedException("Invalid email or password.");
        }

        return ToAuthResponse(user);
    }

    private async Task<User> CreateUserAsync(string email, string password, UserRole role, CancellationToken cancellationToken)
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
            CreatedAtUtc = DateTime.UtcNow
        };
        await _userRepository.AddAsync(user, cancellationToken);

        return user;
    }

    private AuthResponse ToAuthResponse(User user) =>
        new(user.Id, user.Email, user.Role.ToString(), _tokenService.CreateToken(user));
}
