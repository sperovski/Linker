using Linker.Domain.Entities;
using Linker.Domain.Enums;
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

    public async Task<IReadOnlyList<Internship>> SearchActiveAsync(string? location, string? searchText, InternshipType? type, CancellationToken cancellationToken = default)
    {
        var query = Context.Internships
            .AsNoTracking()
            .Include(i => i.Company)
            .Where(i => i.IsActive);

        if (type.HasValue)
        {
            query = query.Where(i => i.Type == type.Value);
        }

        if (!string.IsNullOrWhiteSpace(location))
        {
            query = query.Where(i => i.Location != null && EF.Functions.ILike(i.Location, $"%{location}%"));
        }

        if (!string.IsNullOrWhiteSpace(searchText))
        {
            query = query.Where(i =>
                EF.Functions.ILike(i.Title, $"%{searchText}%") ||
                EF.Functions.ILike(i.Description, $"%{searchText}%"));
        }

        return await query
            .OrderByDescending(i => i.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<Internship?> GetWithCompanyAsync(int id, CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .Include(i => i.Company)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
    }
}
