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
}
