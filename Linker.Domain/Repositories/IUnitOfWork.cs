namespace Linker.Domain.Repositories;

/// <summary>
/// Commits all pending repository mutations as one atomic unit. Repositories
/// only stage changes; nothing hits the database until a service calls this.
/// </summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
