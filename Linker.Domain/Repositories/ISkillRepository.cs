using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface ISkillRepository : IRepository<Skill>
{
    Task<Skill?> GetByNameAsync(string name, CancellationToken cancellationToken = default);
}
