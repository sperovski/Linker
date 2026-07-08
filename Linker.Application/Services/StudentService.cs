using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Students;
using Linker.Application.Mappings;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class StudentService : IStudentService
{
    private readonly IStudentRepository _studentRepository;
    private readonly IUnitOfWork _unitOfWork;

    public StudentService(IStudentRepository studentRepository, IUnitOfWork unitOfWork)
    {
        _studentRepository = studentRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<StudentProfileResponse> GetByIdAsync(int studentId, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetWithSkillsAsync(studentId, cancellationToken)
            ?? throw new NotFoundException("Student", studentId);

        return student.ToResponse();
    }

    public async Task<StudentProfileResponse> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> UpdateProfileAsync(int userId, UpdateStudentProfileRequest request, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");

        student.FirstName = request.FirstName;
        student.LastName = request.LastName;
        student.University = request.University;
        student.GraduationYear = request.GraduationYear;
        student.Bio = request.Bio;

        _studentRepository.Update(student);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }
}
