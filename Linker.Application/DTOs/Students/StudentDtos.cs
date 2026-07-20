using System.ComponentModel.DataAnnotations;
using Linker.Application.DTOs.Skills;

namespace Linker.Application.DTOs.Students;

/// <summary>
/// Result of importing a CV: the saved profile plus what reading the file
/// actually changed, so the UI can tell the student what was picked up instead
/// of silently mutating their profile.
///
/// A bio is only applied when the student had none — an existing bio is never
/// overwritten, and the generated one comes back as <see cref="SuggestedBio"/>
/// for them to accept or ignore.
/// </summary>
public record CvImportResponse(
    StudentProfileResponse Profile,
    IReadOnlyList<string> AddedSkills,
    string? SuggestedBio,
    bool BioApplied,
    // False when the file yielded no readable text (e.g. a scanned, image-only
    // PDF). The upload still succeeds; there was just nothing to import from.
    bool TextExtracted);

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
