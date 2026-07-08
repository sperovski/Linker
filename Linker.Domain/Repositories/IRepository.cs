namespace Linker.Domain.Repositories;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken cancellationToken = default);

    // Writes only stage changes; commit via IUnitOfWork.SaveChangesAsync.
    void Add(T entity);
    void Update(T entity);
    void Remove(T entity);
}
