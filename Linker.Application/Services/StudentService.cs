using Linker.Application.Common;
using Linker.Application.Common.Exceptions;
using Linker.Application.Common.Interfaces;
using Linker.Application.DTOs.Students;
using Linker.Application.Mappings;
using Linker.Domain.Entities;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

public class StudentService : IStudentService
{
    private static readonly HashSet<string> AllowedCvExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx",
    };

    private readonly IStudentRepository _studentRepository;
    private readonly IExperienceRepository _experienceRepository;
    private readonly IEducationRepository _educationRepository;
    private readonly IProjectRepository _projectRepository;
    private readonly ICompanyRepository _companyRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly ISkillRepository _skillRepository;
    private readonly ICvFileStorage _cvFileStorage;
    private readonly ICvTextExtractor _cvTextExtractor;
    private readonly IUnitOfWork _unitOfWork;

    public StudentService(
        IStudentRepository studentRepository,
        IExperienceRepository experienceRepository,
        IEducationRepository educationRepository,
        IProjectRepository projectRepository,
        ICompanyRepository companyRepository,
        IApplicationRepository applicationRepository,
        ISkillRepository skillRepository,
        ICvFileStorage cvFileStorage,
        ICvTextExtractor cvTextExtractor,
        IUnitOfWork unitOfWork)
    {
        _studentRepository = studentRepository;
        _experienceRepository = experienceRepository;
        _educationRepository = educationRepository;
        _projectRepository = projectRepository;
        _companyRepository = companyRepository;
        _applicationRepository = applicationRepository;
        _skillRepository = skillRepository;
        _cvFileStorage = cvFileStorage;
        _cvTextExtractor = cvTextExtractor;
        _unitOfWork = unitOfWork;
    }

    public async Task<StudentProfileResponse> GetByIdAsync(int studentId, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetWithProfileAsync(studentId, cancellationToken)
            ?? throw new NotFoundException("Student", studentId);

        return student.ToResponse();
    }

    public async Task<StudentProfileResponse> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default)
    {
        var student = await GetOwnStudentAsync(userId, cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> UpdateProfileAsync(int userId, UpdateStudentProfileRequest request, CancellationToken cancellationToken = default)
    {
        var student = await GetOwnStudentAsync(userId, cancellationToken);

        student.FirstName = request.FirstName;
        student.LastName = request.LastName;
        student.University = request.University;
        student.GraduationYear = request.GraduationYear;
        student.Bio = request.Bio;
        student.Headline = request.Headline;
        student.ProfilePhotoUrl = request.ProfilePhotoUrl;
        student.LinkedInUrl = request.LinkedInUrl;
        student.GithubUrl = request.GithubUrl;
        student.PortfolioUrl = request.PortfolioUrl;
        student.CvUrl = request.CvUrl;

        _studentRepository.Update(student);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    /// <summary>
    /// Stores the CV and imports what it can read from it: skills that match the
    /// catalogue are added to the profile, and a bio is generated when the
    /// student doesn't have one.
    ///
    /// Importing is best-effort. A CV we can't read text from (a scanned,
    /// image-only PDF) still uploads successfully — losing the enrichment is a
    /// far better outcome than rejecting a file the student can see is fine.
    /// </summary>
    public async Task<CvImportResponse> UploadCvAsync(int userId, string fileName, byte[] content, CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(fileName);
        if (!AllowedCvExtensions.Contains(extension))
        {
            throw new BadRequestException("Your CV must be a PDF, DOC or DOCX file.");
        }

        var student = await GetOwnStudentAsync(userId, cancellationToken);

        var previousUrl = student.CvUrl;
        student.CvUrl = await _cvFileStorage.SaveAsync(student.Id, fileName, content, cancellationToken);
        _studentRepository.Update(student);

        var text = TryExtractText(content, fileName);
        var addedSkills = text is null
            ? []
            : await AddDetectedSkillsAsync(student.Id, text, cancellationToken);

        string? suggestedBio = null;
        var bioApplied = false;
        if (text is not null)
        {
            suggestedBio = CvBioGenerator.Generate(text, await DetectedSkillNamesAsync(text, cancellationToken));
            // Never overwrite a bio the student wrote themselves.
            if (suggestedBio is not null && string.IsNullOrWhiteSpace(student.Bio))
            {
                student.Bio = suggestedBio;
                bioApplied = true;
                suggestedBio = null;
            }
        }

        // One commit for the file url, the imported skills and the bio.
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Only after the new file is committed — if SaveChangesAsync throws, the old file stays valid.
        _cvFileStorage.DeleteIfManaged(previousUrl);

        return new CvImportResponse(
            await GetByIdAsync(student.Id, cancellationToken),
            addedSkills,
            suggestedBio,
            bioApplied,
            text is not null);
    }

    /// <summary>
    /// Text extraction throws for unreadable files. That must not fail the
    /// upload, so failures degrade to "nothing to import".
    /// </summary>
    private string? TryExtractText(byte[] content, string fileName)
    {
        try
        {
            var text = _cvTextExtractor.Extract(content, fileName);
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private async Task<IReadOnlyList<string>> DetectedSkillNamesAsync(string text, CancellationToken cancellationToken)
    {
        var catalogue = await _skillRepository.GetAllAsync(cancellationToken);
        return CvSkillMatcher.DetectSkills(text, catalogue.Select(s => s.Name));
    }

    /// <summary>Adds catalogue skills found in the CV that aren't already on the profile.</summary>
    private async Task<IReadOnlyList<string>> AddDetectedSkillsAsync(int studentId, string text, CancellationToken cancellationToken)
    {
        var catalogue = await _skillRepository.GetAllAsync(cancellationToken);
        var detected = CvSkillMatcher.DetectSkills(text, catalogue.Select(s => s.Name)).ToHashSet();
        if (detected.Count == 0)
        {
            return [];
        }

        var withSkills = await _studentRepository.GetWithSkillsAsync(studentId, cancellationToken);
        if (withSkills is null)
        {
            return [];
        }

        var owned = withSkills.Skills.Select(ss => ss.SkillId).ToHashSet();
        var toAdd = catalogue.Where(s => detected.Contains(s.Name) && !owned.Contains(s.Id)).ToList();

        foreach (var skill in toAdd)
        {
            withSkills.Skills.Add(new StudentSkill { StudentId = studentId, SkillId = skill.Id });
        }

        return toAdd.Select(s => s.Name).ToList();
    }

    /// <summary>
    /// Streams a student's uploaded CV, but only to the student themselves or a company they've
    /// applied to. A CV is personal data, so it is never served as an anonymous static file —
    /// this is the sole read path, and it authorises every request.
    /// </summary>
    public async Task<CvFileContent> GetCvFileAsync(int requesterUserId, int studentId, CancellationToken cancellationToken = default)
    {
        var student = await _studentRepository.GetByIdAsync(studentId, cancellationToken)
            ?? throw new NotFoundException("Student", studentId);

        // Only uploaded files are served here; an externally-linked CvUrl isn't ours to stream.
        if (!_cvFileStorage.IsManaged(student.CvUrl))
        {
            throw new NotFoundException("This student has no uploaded CV.");
        }

        if (!await CanViewCvAsync(requesterUserId, studentId, cancellationToken))
        {
            throw new ForbiddenAccessException("You do not have access to this CV.");
        }

        return await _cvFileStorage.OpenAsync(student.CvUrl, cancellationToken)
            ?? throw new NotFoundException("This student's CV file could not be found.");
    }

    /// <summary>The owning student, or a company the student has applied to, may view a CV.</summary>
    private async Task<bool> CanViewCvAsync(int requesterUserId, int studentId, CancellationToken cancellationToken)
    {
        var requestingStudent = await _studentRepository.GetByUserIdAsync(requesterUserId, cancellationToken);
        if (requestingStudent is not null)
        {
            return requestingStudent.Id == studentId;
        }

        var company = await _companyRepository.GetByUserIdAsync(requesterUserId, cancellationToken);
        if (company is not null)
        {
            return await _applicationRepository.ExistsForStudentAndCompanyAsync(studentId, company.Id, cancellationToken);
        }

        return false;
    }

    // ---- Experience ----

    public async Task<StudentProfileResponse> AddExperienceAsync(int userId, SaveExperienceRequest request, CancellationToken cancellationToken = default)
    {
        ValidateDates(request.StartDate, request.EndDate);
        var student = await GetOwnStudentAsync(userId, cancellationToken);

        _experienceRepository.Add(new Experience
        {
            StudentId = student.Id,
            Title = request.Title,
            Company = request.Company,
            Location = request.Location,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Description = request.Description,
        });
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> UpdateExperienceAsync(int userId, int experienceId, SaveExperienceRequest request, CancellationToken cancellationToken = default)
    {
        ValidateDates(request.StartDate, request.EndDate);
        var student = await GetOwnStudentAsync(userId, cancellationToken);
        var experience = await GetOwnedAsync(_experienceRepository, experienceId, student.Id, e => e.StudentId, "Experience", cancellationToken);

        experience.Title = request.Title;
        experience.Company = request.Company;
        experience.Location = request.Location;
        experience.StartDate = request.StartDate;
        experience.EndDate = request.EndDate;
        experience.Description = request.Description;

        _experienceRepository.Update(experience);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> DeleteExperienceAsync(int userId, int experienceId, CancellationToken cancellationToken = default)
    {
        var student = await GetOwnStudentAsync(userId, cancellationToken);
        var experience = await GetOwnedAsync(_experienceRepository, experienceId, student.Id, e => e.StudentId, "Experience", cancellationToken);

        _experienceRepository.Remove(experience);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    // ---- Education ----

    public async Task<StudentProfileResponse> AddEducationAsync(int userId, SaveEducationRequest request, CancellationToken cancellationToken = default)
    {
        ValidateDates(request.StartDate, request.EndDate);
        var student = await GetOwnStudentAsync(userId, cancellationToken);

        _educationRepository.Add(new Education
        {
            StudentId = student.Id,
            Institution = request.Institution,
            Degree = request.Degree,
            FieldOfStudy = request.FieldOfStudy,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
        });
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> UpdateEducationAsync(int userId, int educationId, SaveEducationRequest request, CancellationToken cancellationToken = default)
    {
        ValidateDates(request.StartDate, request.EndDate);
        var student = await GetOwnStudentAsync(userId, cancellationToken);
        var education = await GetOwnedAsync(_educationRepository, educationId, student.Id, e => e.StudentId, "Education", cancellationToken);

        education.Institution = request.Institution;
        education.Degree = request.Degree;
        education.FieldOfStudy = request.FieldOfStudy;
        education.StartDate = request.StartDate;
        education.EndDate = request.EndDate;

        _educationRepository.Update(education);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> DeleteEducationAsync(int userId, int educationId, CancellationToken cancellationToken = default)
    {
        var student = await GetOwnStudentAsync(userId, cancellationToken);
        var education = await GetOwnedAsync(_educationRepository, educationId, student.Id, e => e.StudentId, "Education", cancellationToken);

        _educationRepository.Remove(education);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    // ---- Project ----

    public async Task<StudentProfileResponse> AddProjectAsync(int userId, SaveProjectRequest request, CancellationToken cancellationToken = default)
    {
        var student = await GetOwnStudentAsync(userId, cancellationToken);

        _projectRepository.Add(new Project
        {
            StudentId = student.Id,
            Title = request.Title,
            Description = request.Description,
            Url = request.Url,
            TechStack = request.TechStack,
        });
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> UpdateProjectAsync(int userId, int projectId, SaveProjectRequest request, CancellationToken cancellationToken = default)
    {
        var student = await GetOwnStudentAsync(userId, cancellationToken);
        var project = await GetOwnedAsync(_projectRepository, projectId, student.Id, p => p.StudentId, "Project", cancellationToken);

        project.Title = request.Title;
        project.Description = request.Description;
        project.Url = request.Url;
        project.TechStack = request.TechStack;

        _projectRepository.Update(project);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    public async Task<StudentProfileResponse> DeleteProjectAsync(int userId, int projectId, CancellationToken cancellationToken = default)
    {
        var student = await GetOwnStudentAsync(userId, cancellationToken);
        var project = await GetOwnedAsync(_projectRepository, projectId, student.Id, p => p.StudentId, "Project", cancellationToken);

        _projectRepository.Remove(project);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(student.Id, cancellationToken);
    }

    // ---- Helpers ----

    private async Task<Student> GetOwnStudentAsync(int userId, CancellationToken cancellationToken)
    {
        return await _studentRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException($"No student profile exists for user '{userId}'.");
    }

    /// <summary>Loads a section entry and verifies it belongs to the calling student.</summary>
    private static async Task<T> GetOwnedAsync<T>(
        IRepository<T> repository,
        int id,
        int studentId,
        Func<T, int> studentIdOf,
        string entityName,
        CancellationToken cancellationToken) where T : class
    {
        var entity = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(entityName, id);

        if (studentIdOf(entity) != studentId)
        {
            throw new ForbiddenAccessException($"This {entityName.ToLowerInvariant()} entry belongs to another student.");
        }

        return entity;
    }

    private static void ValidateDates(DateOnly startDate, DateOnly? endDate)
    {
        if (endDate.HasValue && endDate.Value < startDate)
        {
            throw new BadRequestException("The end date cannot be before the start date.");
        }
    }
}
