using Linker.Application.Common.Exceptions;
using Linker.Application.DTOs.Applications;
using Linker.Application.DTOs.Common;
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
    private readonly INotificationService _notificationService;
    private readonly IUnitOfWork _unitOfWork;

    public ApplicationService(
        IApplicationRepository applicationRepository,
        IInternshipRepository internshipRepository,
        IStudentRepository studentRepository,
        ICompanyRepository companyRepository,
        INotificationService notificationService,
        IUnitOfWork unitOfWork)
    {
        _applicationRepository = applicationRepository;
        _internshipRepository = internshipRepository;
        _studentRepository = studentRepository;
        _companyRepository = companyRepository;
        _notificationService = notificationService;
        _unitOfWork = unitOfWork;
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

        if (internship.ApplicationDeadline is { } deadline && deadline < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new ConflictException("The application deadline for this internship has passed.");
        }

        var existing = await _applicationRepository.GetByStudentAndInternshipAsync(student.Id, internship.Id, cancellationToken);
        if (existing is not null)
        {
            if (existing.Status != ApplicationStatus.Withdrawn)
            {
                throw new ConflictException("You have already applied to this internship.");
            }

            // Re-applying after a withdrawal reactivates the original application
            // (a unique index on StudentId+InternshipId means one row per pair).
            existing.Status = ApplicationStatus.Submitted;
            existing.CoverNote = request.CoverNote;
            existing.CreatedAt = DateTime.UtcNow;
            existing.UpdatedAt = existing.CreatedAt;
            NotifyCompanyOfApplication(internship, student);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            existing.Student = student;
            existing.Internship = internship;
            return existing.ToResponse();
        }

        var now = DateTime.UtcNow;
        var application = new ApplicationEntity
        {
            StudentId = student.Id,
            InternshipId = internship.Id,
            Status = ApplicationStatus.Submitted,
            CoverNote = request.CoverNote,
            CreatedAt = now,
            UpdatedAt = now
        };
        _applicationRepository.Add(application);
        NotifyCompanyOfApplication(internship, student);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        application.Student = student;
        application.Internship = internship;
        return application.ToResponse();
    }

    private void NotifyCompanyOfApplication(Domain.Entities.Internship internship, Domain.Entities.Student student)
    {
        _notificationService.Create(
            internship.Company.UserId,
            $"{student.FirstName} {student.LastName} applied to \"{internship.Title}\".",
            $"/company/internships/{internship.Id}/applicants");
    }

    // Statuses a company may set. Submitted is the system's initial state and
    // Withdrawn belongs to the student, so neither is assignable here.
    private static readonly ApplicationStatus[] CompanySettableStatuses =
    [
        ApplicationStatus.UnderReview,
        ApplicationStatus.Accepted,
        ApplicationStatus.Rejected,
    ];

    public async Task<ApplicationResponse> UpdateStatusAsync(int userId, int applicationId, UpdateApplicationStatusRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<ApplicationStatus>(request.Status, ignoreCase: true, out var status)
            || !CompanySettableStatuses.Contains(status))
        {
            var validValues = string.Join(", ", CompanySettableStatuses);
            throw new BadRequestException($"'{request.Status}' is not a status a company can set. Valid values: {validValues}.");
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
        application.UpdatedAt = DateTime.UtcNow;
        // Let the applicant know the moment their status changes.
        _notificationService.Create(
            application.Student.UserId,
            $"{application.Internship.Company.Name} marked your application for \"{application.Internship.Title}\" as {status}.",
            "/applications");
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return application.ToResponse();
    }

    public async Task<ApplicationResponse> WithdrawAsync(int userId, int applicationId, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");

        var application = await _applicationRepository.GetWithDetailsAsync(applicationId, cancellationToken)
            ?? throw new NotFoundException("Application", applicationId);

        if (application.StudentId != student.Id)
        {
            throw new ForbiddenAccessException("You can only withdraw your own applications.");
        }

        if (application.Status == ApplicationStatus.Withdrawn)
        {
            throw new ConflictException("This application has already been withdrawn.");
        }

        if (application.Status == ApplicationStatus.Rejected)
        {
            throw new ConflictException("A rejected application cannot be withdrawn.");
        }

        application.Status = ApplicationStatus.Withdrawn;
        application.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(cancellationToken);

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

    public async Task<PagedResponse<ApplicantResponse>> GetByInternshipAsync(
        int userId, int internshipId, int page = 1, int pageSize = Paging.DefaultPageSize, CancellationToken cancellationToken = default)
    {
        var internship = await _internshipRepository.GetByIdAsync(internshipId, cancellationToken)
            ?? throw new NotFoundException("Internship", internshipId);

        var company = await _companyRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No company profile exists for user '{userId}'.");

        // Ownership is settled before we touch the applications table at all.
        if (internship.CompanyId != company.Id)
        {
            throw new ForbiddenAccessException("Only the company that posted this internship can view its applications.");
        }

        (page, pageSize) = Paging.Normalize(page, pageSize);
        var (applications, total) = await _applicationRepository.GetByInternshipAsync(internshipId, page, pageSize, cancellationToken);

        return new PagedResponse<ApplicantResponse>(
            applications.Select(a => a.ToApplicantResponse()).ToList(), total, page, pageSize);
    }
}
