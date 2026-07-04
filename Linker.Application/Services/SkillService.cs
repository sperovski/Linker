using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Skills;
using Linker.Application.DTOs.Students;
using Linker.Application.Mappings;
using Linker.Domain.Entities;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class SkillService : ISkillService
{
    private readonly ISkillRepository _skillRepository;
    private readonly IStudentRepository _studentRepository;

    public SkillService(ISkillRepository skillRepository, IStudentRepository studentRepository)
    {
        _skillRepository = skillRepository;
        _studentRepository = studentRepository;
    }

    public async Task<IReadOnlyList<SkillResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var skills = await _skillRepository.GetAllAsync(cancellationToken);

        return skills.Select(s => s.ToResponse()).ToList();
    }

    public async Task<StudentProfileResponse> AssignToStudentAsync(int userId, AssignSkillRequest request, CancellationToken cancellationToken = default)
    {
        var student = await GetStudentWithSkillsAsync(userId, cancellationToken);

        var skill = await _skillRepository.GetByIdAsync(request.SkillId, cancellationToken)
            ?? throw new NotFoundException("Skill", request.SkillId);

        if (student.Skills.Any(ss => ss.SkillId == skill.Id))
        {
            throw new ConflictException($"Skill '{skill.Name}' is already assigned to this student.");
        }

        student.Skills.Add(new StudentSkill { StudentId = student.Id, SkillId = skill.Id });
        await _studentRepository.UpdateAsync(student, cancellationToken);

        return await GetRefreshedProfileAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> RemoveFromStudentAsync(int userId, int skillId, CancellationToken cancellationToken = default)
    {
        var student = await GetStudentWithSkillsAsync(userId, cancellationToken);

        var studentSkill = student.Skills.FirstOrDefault(ss => ss.SkillId == skillId)
            ?? throw new NotFoundException($"Skill '{skillId}' is not assigned to this student.");

        student.Skills.Remove(studentSkill);
        await _studentRepository.UpdateAsync(student, cancellationToken);

        return await GetRefreshedProfileAsync(student.Id, cancellationToken);
    }

    private async Task<Student> GetStudentWithSkillsAsync(int userId, CancellationToken cancellationToken)
    {
        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");

        return await _studentRepository.GetWithSkillsAsync(student.Id, cancellationToken)
            ?? throw new NotFoundException("Student", student.Id);
    }

    private async Task<StudentProfileResponse> GetRefreshedProfileAsync(int studentId, CancellationToken cancellationToken)
    {
        var student = await _studentRepository.GetWithSkillsAsync(studentId, cancellationToken)
            ?? throw new NotFoundException("Student", studentId);

        return student.ToResponse();
    }
}
