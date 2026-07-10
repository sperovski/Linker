using System.ComponentModel.DataAnnotations;
using Linker.Application.DTOs.Skills;

namespace Linker.Application.DTOs.Students;

public record StudentProfileResponse(
    int Id,
    int UserId,
    string FirstName,
    string LastName,
    string? University,
    int? GraduationYear,
    string? Bio,
    string? Headline,
    string? ProfilePhotoUrl,
    string? LinkedInUrl,
    string? GithubUrl,
    string? PortfolioUrl,
    string? CvUrl,
    IReadOnlyList<SkillResponse> Skills,
    IReadOnlyList<ExperienceResponse> Experiences,
    IReadOnlyList<EducationResponse> Educations,
    IReadOnlyList<ProjectResponse> Projects);

public record UpdateStudentProfileRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [MaxLength(200)] string? University,
    [Range(1950, 2100)] int? GraduationYear,
    [MaxLength(2000)] string? Bio,
    [MaxLength(150)] string? Headline,
    [MaxLength(500), Url] string? ProfilePhotoUrl,
    [MaxLength(500), Url] string? LinkedInUrl,
    [MaxLength(500), Url] string? GithubUrl,
    [MaxLength(500), Url] string? PortfolioUrl,
    [MaxLength(500), Url] string? CvUrl);
