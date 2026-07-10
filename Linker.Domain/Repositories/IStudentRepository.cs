using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

public interface IStudentRepository : IRepository<Student>
{
    Task<Student?> GetByUserIdAsync(int userId, CancellationToken cancellationToken = default);
    Task<Student?> GetWithSkillsAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>Loads the full profile: skills, experiences, education and projects.</summary>
    Task<Student?> GetWithProfileAsync(int id, CancellationToken cancellationToken = default);
}
