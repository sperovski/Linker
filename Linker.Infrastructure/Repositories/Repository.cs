using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly LinkerDbContext Context;

    public Repository(LinkerDbContext context)
    {
        Context = context;
    }

    public virtual async Task<T?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await Context.Set<T>().FindAsync([id], cancellationToken);
    }

    public virtual async Task<IReadOnlyList<T>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await Context.Set<T>().AsNoTracking().ToListAsync(cancellationToken);
    }

    public virtual void Add(T entity) => Context.Set<T>().Add(entity);

    public virtual void Update(T entity) => Context.Set<T>().Update(entity);

    public virtual void Remove(T entity) => Context.Set<T>().Remove(entity);
}
