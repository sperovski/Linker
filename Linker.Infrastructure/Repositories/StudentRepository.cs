using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class StudentRepository : Repository<Student>, IStudentRepository
{
    public StudentRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<Student?> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default)
    {
        return await Context.Students
            .FirstOrDefaultAsync(s => s.UserId == userId, cancellationToken);
    }

    public async Task<Student?> GetWithSkillsAsync(int id, CancellationToken cancellationToken = default)
    {
        return await Context.Students
            .Include(s => s.Skills)
            .ThenInclude(ss => ss.Skill)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }

    public async Task<Student?> GetWithProfileAsync(int id, CancellationToken cancellationToken = default)
    {
        // Split query: four collection includes as one SQL join would explode
        // the row count multiplicatively.
        return await Context.Students
            .Include(s => s.Skills)
            .ThenInclude(ss => ss.Skill)
            .Include(s => s.Experiences)
            .Include(s => s.Educations)
            .Include(s => s.Projects)
            .AsSplitQuery()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }
}
