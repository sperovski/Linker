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
        new(skill.Id, skill.Name);

    public static StudentProfileResponse ToResponse(this Student student) =>
        new(
            student.Id,
            student.UserId,
            student.FirstName,
            student.LastName,
            student.University,
            student.GraduationYear,
            student.Bio,
            student.Skills
                .Where(ss => ss.Skill is not null)
                .Select(ss => ss.Skill.ToResponse())
                .ToList());

    public static CompanyProfileResponse ToResponse(this Company company) =>
        new(
            company.Id,
            company.UserId,
            company.Name,
            company.Description,
            company.Website);

    public static InternshipListItemResponse ToListItemResponse(this Internship internship) =>
        new(
            internship.Id,
            internship.Title,
            internship.Location,
            internship.Type.ToString(),
            internship.Company?.Name ?? string.Empty,
            internship.IsActive,
            internship.StartDate,
            internship.EndDate);

    public static InternshipDetailResponse ToDetailResponse(this Internship internship) =>
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
            internship.IsActive,
            internship.CreatedAtUtc);

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
            application.CoverLetter,
            application.AppliedAtUtc);
}
