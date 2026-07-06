using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Internships;
using Linker.Application.Mappings;
using Linker.Domain.Entities;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class SavedInternshipService : ISavedInternshipService
{
    private readonly ISavedInternshipRepository _savedInternshipRepository;
    private readonly IStudentRepository _studentRepository;
    private readonly IInternshipRepository _internshipRepository;

    public SavedInternshipService(
        ISavedInternshipRepository savedInternshipRepository,
        IStudentRepository studentRepository,
        IInternshipRepository internshipRepository)
    {
        _savedInternshipRepository = savedInternshipRepository;
        _studentRepository = studentRepository;
        _internshipRepository = internshipRepository;
    }

    public async Task<IReadOnlyList<InternshipListItemResponse>> GetSavedAsync(int userId, CancellationToken cancellationToken = default)
    {
        var student = await GetStudentAsync(userId, cancellationToken);

        var saved = await _savedInternshipRepository.GetByStudentAsync(student.Id, cancellationToken);
        if (saved.Count == 0)
        {
            return [];
        }

        var withSkills = await _studentRepository.GetWithSkillsAsync(student.Id, cancellationToken);
        IReadOnlySet<int> skillIds = withSkills!.Skills.Select(ss => ss.SkillId).ToHashSet();
        IReadOnlySet<int> savedIds = saved.Select(si => si.InternshipId).ToHashSet();

        return saved
            .Select(si => si.Internship.ToListItemResponse(skillIds, savedIds))
            .ToList();
    }

    public async Task SaveAsync(int userId, int internshipId, CancellationToken cancellationToken = default)
    {
        var student = await GetStudentAsync(userId, cancellationToken);

        _ = await _internshipRepository.GetByIdAsync(internshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", internshipId);

        var existing = await _savedInternshipRepository.GetAsync(student.Id, internshipId, cancellationToken);
        if (existing is not null)
        {
            // Saving is idempotent — an already-saved internship stays saved.
            return;
        }

        await _savedInternshipRepository.AddAsync(
            new SavedInternship
            {
                StudentId = student.Id,
                InternshipId = internshipId,
                SavedAtUtc = DateTime.UtcNow
            },
            cancellationToken);
    }

    public async Task UnsaveAsync(int userId, int internshipId, CancellationToken cancellationToken = default)
    {
        var student = await GetStudentAsync(userId, cancellationToken);

        var existing = await _savedInternshipRepository.GetAsync(student.Id, internshipId, cancellationToken);
        if (existing is null)
        {
            return;
        }

        await _savedInternshipRepository.RemoveAsync(existing, cancellationToken);
    }

    private async Task<Student> GetStudentAsync(int userId, CancellationToken cancellationToken)
    {
        return await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");
    }
}
