using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface IStudentRepository : IRepository<Student>
{
    Task<Student?> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default);
    Task<Student?> GetWithSkillsAsync(int id, CancellationToken cancellationToken = default);
}
