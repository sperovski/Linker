using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class CompanyRepository : Repository<Company>, ICompanyRepository
{
    public CompanyRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<Company?> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default)
    {
        return await Context.Companies
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);
    }

    public async Task<Company?> GetByIdWithUserAsync(int companyId, CancellationToken cancellationToken = default)
    {
        return await Context.Companies
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);
    }

    public async Task<(IReadOnlyList<Company> Items, int Total)> ListPagedWithUserAsync(
        int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = Context.Companies.AsNoTracking();
        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .Include(c => c.User)
            .Include(c => c.Internships)
            // Id breaks ties so a company can't straddle two pages.
            .OrderByDescending(c => c.User.CreatedAtUtc)
            .ThenByDescending(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }
}
