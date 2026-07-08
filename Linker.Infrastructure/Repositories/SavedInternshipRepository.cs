using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class SavedInternshipRepository : Repository<SavedInternship>, ISavedInternshipRepository
{
    public SavedInternshipRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<SavedInternship>> GetByStudentAsync(int studentId, CancellationToken cancellationToken = default)
    {
        return await Context.SavedInternships
            .AsNoTracking()
            .Include(si => si.Internship)
                .ThenInclude(i => i.Company)
            .Include(si => si.Internship)
                .ThenInclude(i => i.RequiredSkills)
                    .ThenInclude(rs => rs.Skill)
            .Where(si => si.StudentId == studentId)
            .OrderByDescending(si => si.SavedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<SavedInternship?> GetAsync(int studentId, int internshipId, CancellationToken cancellationToken = default)
    {
        return await Context.SavedInternships
            .FirstOrDefaultAsync(si => si.StudentId == studentId && si.InternshipId == internshipId, cancellationToken);
    }

    public async Task<IReadOnlyList<int>> GetSavedInternshipIdsAsync(int studentId, CancellationToken cancellationToken = default)
    {
        return await Context.SavedInternships
            .AsNoTracking()
            .Where(si => si.StudentId == studentId)
            .Select(si => si.InternshipId)
            .ToListAsync(cancellationToken);
    }
}
