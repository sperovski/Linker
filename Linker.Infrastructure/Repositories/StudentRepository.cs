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
}
