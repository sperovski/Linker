using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Applications;
using Linker.Application.Mappings;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;
using ApplicationEntity = Linker.Domain.Entities.Application;

namespace Linker.Application.Services;

public class ApplicationService : IApplicationService
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly IInternshipRepository _internshipRepository;
    private readonly IStudentRepository _studentRepository;
    private readonly ICompanyRepository _companyRepository;

    public ApplicationService(
        IApplicationRepository applicationRepository,
        IInternshipRepository internshipRepository,
        IStudentRepository studentRepository,
        ICompanyRepository companyRepository)
    {
        _applicationRepository = applicationRepository;
        _internshipRepository = internshipRepository;
        _studentRepository = studentRepository;
        _companyRepository = companyRepository;
    }

    public async Task<ApplicationResponse> ApplyAsync(int userId, CreateApplicationRequest request, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");

        var internship = await _internshipRepository.GetWithCompanyAsync(request.InternshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", request.InternshipId);

        if (!internship.IsActive)
        {
            throw new ConflictException("This internship is closed and no longer accepts applications.");
        }

        if (await _applicationRepository.ExistsAsync(student.Id, internship.Id, cancellationToken))
        {
            throw new ConflictException("You have already applied to this internship.");
        }

        var application = new ApplicationEntity
        {
            StudentId = student.Id,
            InternshipId = internship.Id,
            Status = ApplicationStatus.Pending,
            CoverLetter = request.CoverLetter,
            AppliedAtUtc = DateTime.UtcNow
        };
        await _applicationRepository.AddAsync(application, cancellationToken);

        application.Student = student;
        application.Internship = internship;
        return application.ToResponse();
    }

    public async Task<ApplicationResponse> UpdateStatusAsync(int userId, int applicationId, UpdateApplicationStatusRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<ApplicationStatus>(request.Status, ignoreCase: true, out var status))
        {
            var validValues = string.Join(", ", Enum.GetNames<ApplicationStatus>());
            throw new ConflictException($"'{request.Status}' is not a valid application status. Valid values: {validValues}.");
        }

        var application = await _applicationRepository.GetWithDetailsAsync(applicationId, cancellationToken)
            ?? throw new NotFoundException("Application", applicationId);

        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No company profile exists for user '{userId}'.");

        if (application.Internship.CompanyId != company.Id)
        {
            throw new ForbiddenAccessException("Only the company that posted the internship can update this application.");
        }

        application.Status = status;
        await _applicationRepository.UpdateAsync(application, cancellationToken);

        return application.ToResponse();
    }

    public async Task<ApplicationResponse> GetByIdAsync(int userId, int applicationId, CancellationToken cancellationToken = default)
    {
        var application = await _applicationRepository.GetWithDetailsAsync(applicationId, cancellationToken)
            ?? throw new NotFoundException("Application", applicationId);

        // Visible to the applying student and to the company that owns the internship.
        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken);
        if (student is not null && student.Id == application.StudentId)
        {
            return application.ToResponse();
        }

        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken);
        if (company is not null && company.Id == application.Internship.CompanyId)
        {
            return application.ToResponse();
        }

        throw new ForbiddenAccessException("You do not have access to this application.");
    }

    public async Task<IReadOnlyList<ApplicationResponse>> GetOwnApplicationsAsync(int userId, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");

        var applications = await _applicationRepository.GetByStudentAsync(student.Id, cancellationToken);

        return applications.Select(a => a.ToResponse()).ToList();
    }

    public async Task<IReadOnlyList<ApplicationResponse>> GetByInternshipAsync(int userId, int internshipId, CancellationToken cancellationToken = default)
    {
        var internship = await _internshipRepository.GetByIdAsync(internshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", internshipId);

        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No company profile exists for user '{userId}'.");

        if (internship.CompanyId != company.Id)
        {
            throw new ForbiddenAccessException("Only the company that posted this internship can view its applications.");
        }

        var applications = await _applicationRepository.GetByInternshipAsync(internshipId, cancellationToken);

        return applications.Select(a => a.ToResponse()).ToList();
    }
}
