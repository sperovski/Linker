using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class ApplicationRepository : Repository<Application>, IApplicationRepository
{
    public ApplicationRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<Application>> GetByStudentAsync(int studentId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .AsNoTracking()
            .Where(a => a.StudentId == studentId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Application>> GetByInternshipAsync(int internshipId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .AsNoTracking()
            .Where(a => a.InternshipId == internshipId)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ExistsAsync(int studentId, int internshipId, CancellationToken cancellationToken = default)
    {
        return await Context.Applications
            .AnyAsync(a => a.StudentId == studentId && a.InternshipId == internshipId, cancellationToken);
    }
}
