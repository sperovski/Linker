using Linker.Application.DTOs.Applications;
using Linker.Application.DTOs.Companies;
using Linker.Application.DTOs.Internships;
using Linker.Application.DTOs.Skills;
using Linker.Application.DTOs.Students;
using Linker.Domain.Entities;
using ApplicationEntity = Linker.Domain.Entities.Application;

namespace Linker.Application.Mappings;

public static class EntityMappings
{
    public static SkillResponse ToResponse(this Skill skill) =>
        new(skill.Id, skill.Name, skill.Category);

    public static ExperienceResponse ToResponse(this Experience experience) =>
        new(
            experience.Id,
            experience.Title,
            experience.Company,
            experience.Location,
            experience.StartDate,
            experience.EndDate,
            experience.Description);

    public static EducationResponse ToResponse(this Education education) =>
        new(
            education.Id,
            education.Institution,
            education.Degree,
            education.FieldOfStudy,
            education.StartDate,
            education.EndDate);

    public static ProjectResponse ToResponse(this Project project) =>
        new(
            project.Id,
            project.Title,
            project.Description,
            project.Url,
            project.TechStack);

    public static StudentProfileResponse ToResponse(this Student student) =>
        new(
            student.Id,
            student.UserId,
            student.FirstName,
            student.LastName,
            student.University,
            student.GraduationYear,
            student.Bio,
            student.Headline,
            student.ProfilePhotoUrl,
            student.LinkedInUrl,
            student.GithubUrl,
            student.PortfolioUrl,
            student.CvUrl,
            student.Skills
                .Where(ss => ss.Skill is not null)
                .Select(ss => ss.Skill.ToResponse())
                .ToList(),
            // Ongoing entries (no end date) first, then most recent.
            student.Experiences
                .OrderBy(e => e.EndDate.HasValue)
                .ThenByDescending(e => e.EndDate)
                .ThenByDescending(e => e.StartDate)
                .Select(e => e.ToResponse())
                .ToList(),
            student.Educations
                .OrderBy(e => e.EndDate.HasValue)
                .ThenByDescending(e => e.EndDate)
                .ThenByDescending(e => e.StartDate)
                .Select(e => e.ToResponse())
                .ToList(),
            student.Projects
                .OrderByDescending(p => p.Id)
                .Select(p => p.ToResponse())
                .ToList());

    public static CompanyProfileResponse ToResponse(this Company company) =>
        new(
            company.Id,
            company.UserId,
            company.Name,
            company.Description,
            company.Website);

    public static InternshipListItemResponse ToListItemResponse(
        this Internship internship,
        IReadOnlySet<int>? studentSkillIds = null,
        IReadOnlySet<int>? savedInternshipIds = null) =>
        new(
            internship.Id,
            internship.Title,
            internship.Location,
            internship.Type.ToString(),
            internship.Company?.Name ?? string.Empty,
            internship.IsActive,
            internship.StartDate,
            internship.EndDate,
            internship.ApplicationDeadline,
            internship.RequiredSkillResponses(),
            internship.MatchScore(studentSkillIds),
            savedInternshipIds?.Contains(internship.Id) ?? false);

    public static InternshipDetailResponse ToDetailResponse(
        this Internship internship,
        IReadOnlySet<int>? studentSkillIds = null,
        IReadOnlySet<int>? savedInternshipIds = null) =>
        new(
            internship.Id,
            internship.CompanyId,
            internship.Company?.Name ?? string.Empty,
            internship.Title,
            internship.Description,
            internship.Location,
            internship.Type.ToString(),
            internship.StartDate,
            internship.EndDate,
            internship.ApplicationDeadline,
            internship.IsActive,
            internship.CreatedAtUtc,
            internship.RequiredSkillResponses(),
            internship.MatchScore(studentSkillIds),
            savedInternshipIds?.Contains(internship.Id) ?? false);

    private static IReadOnlyList<SkillResponse> RequiredSkillResponses(this Internship internship) =>
        internship.RequiredSkills
            .Where(rs => rs.Skill is not null)
            .OrderBy(rs => rs.Skill.Name)
            .Select(rs => rs.Skill.ToResponse())
            .ToList();

    // Share of an internship's required skills that the student already has,
    // as a 0-100 percentage. Null when there is no student context or the
    // internship lists no required skills (nothing meaningful to match on).
    private static int? MatchScore(this Internship internship, IReadOnlySet<int>? studentSkillIds)
    {
        if (studentSkillIds is null)
        {
            return null;
        }

        var required = internship.RequiredSkills.Select(rs => rs.SkillId).ToList();
        if (required.Count == 0)
        {
            return null;
        }

        var matched = required.Count(studentSkillIds.Contains);
        return (int)Math.Round(matched * 100.0 / required.Count);
    }

    public static ApplicationResponse ToResponse(this ApplicationEntity application) =>
        new(
            application.Id,
            application.StudentId,
            application.Student is null
                ? string.Empty
                : $"{application.Student.FirstName} {application.Student.LastName}",
            application.InternshipId,
            application.Internship?.Title ?? string.Empty,
            application.Internship?.Company?.Name ?? string.Empty,
            application.Status.ToString(),
            application.CoverNote,
            application.CreatedAt,
            application.UpdatedAt);

    public static ApplicantResponse ToApplicantResponse(this ApplicationEntity application)
    {
        var student = application.Student;

        return new ApplicantResponse(
            application.Id,
            application.StudentId,
            student is null ? string.Empty : $"{student.FirstName} {student.LastName}",
            student?.University,
            student?.GraduationYear,
            student?.Bio,
            student?.Skills
                .Where(ss => ss.Skill is not null)
                .OrderBy(ss => ss.Skill.Name)
                .Select(ss => ss.Skill.ToResponse())
                .ToList() ?? [],
            application.Status.ToString(),
            application.CoverNote,
            application.CreatedAt,
            application.UpdatedAt);
    }
}
