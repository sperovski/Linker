using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class InternshipRepository : Repository<Internship>, IInternshipRepository
{
    public InternshipRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<Internship>> GetByCompanyAsync(int companyId, CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .AsNoTracking()
            .Where(i => i.CompanyId == companyId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Internship>> GetActiveAsync(CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .AsNoTracking()
            .Where(i => i.IsActive)
            .ToListAsync(cancellationToken);
    }
}
