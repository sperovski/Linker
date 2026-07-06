using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class SavedInternshipRepository : ISavedInternshipRepository
{
    private readonly LinkerDbContext _context;

    public SavedInternshipRepository(LinkerDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<SavedInternship>> GetByStudentAsync(int studentId, CancellationToken cancellationToken = default)
    {
        return await _context.SavedInternships
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
        return await _context.SavedInternships
            .FirstOrDefaultAsync(si => si.StudentId == studentId && si.InternshipId == internshipId, cancellationToken);
    }

    public async Task<IReadOnlyList<int>> GetSavedInternshipIdsAsync(int studentId, CancellationToken cancellationToken = default)
    {
        return await _context.SavedInternships
            .AsNoTracking()
            .Where(si => si.StudentId == studentId)
            .Select(si => si.InternshipId)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(SavedInternship savedInternship, CancellationToken cancellationToken = default)
    {
        _context.SavedInternships.Add(savedInternship);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveAsync(SavedInternship savedInternship, CancellationToken cancellationToken = default)
    {
        _context.SavedInternships.Remove(savedInternship);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
