using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class SkillRepository : Repository<Skill>, ISkillRepository
{
    public SkillRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<Skill?> GetByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        return await Context.Skills
            .FirstOrDefaultAsync(s => s.Name == name, cancellationToken);
    }
}
