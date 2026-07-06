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

    public async Task<IReadOnlyList<ApplicationEntity>> GetByInternshipAsync(int internshipId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .AsNoTracking()
            .Include(a => a.Student)
            .Include(a => a.Internship)
            .ThenInclude(i => i.Company)
            .Where(a => a.InternshipId == internshipId)
            .ToListAsync(cancellationToken);
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

    public async Task<bool> ExistsAsync(int studentId, int internshipId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .AnyAsync(a => a.StudentId == studentId && a.InternshipId == internshipId, cancellationToken);
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
