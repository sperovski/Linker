using Linker.Domain.Entities;
using ApplicationEntity = Linker.Domain.Entities.Application;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class ApplicationRepository : Repository<ApplicationEntity>, IApplicationRepository
{
    public ApplicationRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<ApplicationEntity>> GetByStudentAsync(int studentId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .AsNoTracking()
            .Include(a => a.Student)
            .Include(a => a.Internship)
            .ThenInclude(i => i.Company)
            .Where(a => a.StudentId == studentId)
            .ToListAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<ApplicationEntity> Items, int Total)> GetByInternshipAsync(
        int internshipId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var filtered = Context.Applications
            .AsNoTracking()
            .Where(a => a.InternshipId == internshipId);

        var total = await filtered.CountAsync(cancellationToken);

        // Student skills are included so the applicants page can render each
        // profile from this one query instead of a request per applicant.
        // Id breaks AppliedAtUtc ties so a row can't straddle two pages.
        var items = await filtered
            .Include(a => a.Student)
                .ThenInclude(s => s.Skills)
                .ThenInclude(ss => ss.Skill)
            .Include(a => a.Internship)
            .ThenInclude(i => i.Company)
            .OrderByDescending(a => a.AppliedAtUtc)
            .ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public async Task<IReadOnlyList<ApplicationEntity>> GetByCompanyAsync(int companyId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .AsNoTracking()
            .Include(a => a.Student)
            .Include(a => a.Internship)
            .ThenInclude(i => i.Company)
            .Where(a => a.Internship.CompanyId == companyId)
            .OrderByDescending(a => a.AppliedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<ApplicationEntity?> GetByStudentAndInternshipAsync(int studentId, int internshipId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .FirstOrDefaultAsync(a => a.StudentId == studentId && a.InternshipId == internshipId, cancellationToken);
    }

    public async Task<ApplicationEntity?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .Include(a => a.Student)
            .Include(a => a.Internship)
            .ThenInclude(i => i.Company)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }
}
