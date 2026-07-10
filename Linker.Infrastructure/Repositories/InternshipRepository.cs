using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Repositories;

public class InternshipRepository : Repository<Internship>, IInternshipRepository
{
    public InternshipRepository(LinkerDbContext context) : base(context)
    {
    }

    public async Task<IReadOnlyList<Internship>> GetByCompanyAsync(int companyId, CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .AsNoTracking()
            .Include(i => i.RequiredSkills)
                .ThenInclude(rs => rs.Skill)
            .Where(i => i.CompanyId == companyId)
            .OrderByDescending(i => i.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Internship>> GetActiveAsync(CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .AsNoTracking()
            .Where(i => i.IsActive)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Internship>> GetAllWithCompanyAsync(CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .AsNoTracking()
            .Include(i => i.Company)
            .OrderByDescending(i => i.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<(int Total, int Active)> CountAsync(CancellationToken cancellationToken = default)
    {
        var counts = await Context.Internships
            .GroupBy(_ => 1)
            .Select(g => new { Total = g.Count(), Active = g.Count(i => i.IsActive) })
            .FirstOrDefaultAsync(cancellationToken);

        return counts is null ? (0, 0) : (counts.Total, counts.Active);
    }

    public async Task<(IReadOnlyList<Internship> Items, int Total)> ListPagedWithCompanyAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = Context.Internships.AsNoTracking();

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Include(i => i.Company)
            .OrderByDescending(i => i.CreatedAtUtc)
            .ThenByDescending(i => i.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public async Task<(IReadOnlyList<Internship> Items, int Total)> SearchActiveAsync(
        InternshipSearchCriteria criteria,
        int[]? studentSkillIds,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var filtered = ActiveQuery(criteria);

        // Count before paging, and off the un-included query so Postgres doesn't
        // join the skill/company tables just to produce a number.
        var total = await filtered.CountAsync(cancellationToken);

        var items = await OrderForStudent(WithDetails(filtered), studentSkillIds)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public async Task<IReadOnlyList<Internship>> GetRecommendedForStudentAsync(
        int studentId, int[] studentSkillIds, int take, CancellationToken cancellationToken = default)
    {
        if (studentSkillIds.Length == 0)
        {
            return [];
        }

        var candidates = ActiveQuery(new InternshipSearchCriteria())
            // At least one skill in common — the SQL equivalent of the old
            // `MatchScore is > 0` filter, applied before anything is materialized.
            .Where(i => i.RequiredSkills.Any(rs => studentSkillIds.Contains(rs.SkillId)))
            // Already applied to (in any status, including withdrawn) — don't re-suggest.
            .Where(i => !i.Applications.Any(a => a.StudentId == studentId));

        return await OrderForStudent(WithDetails(candidates), studentSkillIds)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CompanyRoleCount>> GetCompanyFacetsAsync(
        InternshipSearchCriteria criteria, CancellationToken cancellationToken = default)
    {
        // Project to an anonymous type: EF cannot translate a constructor call
        // inside a GroupBy projection, so CompanyRoleCount is built after the read.
        var rows = await ActiveQuery(criteria)
            .GroupBy(i => i.Company!.Name)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .OrderByDescending(row => row.Count)
            .ThenBy(row => row.Name)
            .ToListAsync(cancellationToken);

        return rows.Select(row => new CompanyRoleCount(row.Name, row.Count)).ToList();
    }

    // The single source of truth for "which active listings match this search".
    // Shared by the page query, its count, and the company facet so the three can
    // never drift apart. No Includes: callers that need them opt in via WithDetails.
    private IQueryable<Internship> ActiveQuery(InternshipSearchCriteria criteria)
    {
        var query = Context.Internships
            .AsNoTracking()
            .Where(i => i.IsActive);

        if (criteria.Type.HasValue)
        {
            query = query.Where(i => i.Type == criteria.Type.Value);
        }

        if (!string.IsNullOrWhiteSpace(criteria.Location))
        {
            query = query.Where(i => i.Location != null && EF.Functions.ILike(i.Location, $"%{criteria.Location}%"));
        }

        if (!string.IsNullOrWhiteSpace(criteria.SearchText))
        {
            query = query.Where(i =>
                EF.Functions.ILike(i.Title, $"%{criteria.SearchText}%") ||
                EF.Functions.ILike(i.Description, $"%{criteria.SearchText}%"));
        }

        if (!string.IsNullOrWhiteSpace(criteria.Company))
        {
            query = query.Where(i => i.Company!.Name == criteria.Company);
        }

        return query;
    }

    private static IQueryable<Internship> WithDetails(IQueryable<Internship> query) =>
        query
            .Include(i => i.Company)
            .Include(i => i.RequiredSkills)
                .ThenInclude(rs => rs.Skill);

    // Mirrors EntityMappings.MatchScore as a sort key, but deliberately leaves the
    // ratio unrounded: rounding is monotonic, so this orders identically to the
    // displayed score while breaking ties the display would have merged. Listings
    // with no required skills (and every listing, for anonymous callers) score -1
    // and fall below any genuine match, matching the old `MatchScore ?? -1`.
    // Id is the final tiebreak: without a total order, rows with equal CreatedAtUtc
    // could appear on two pages or none.
    //
    // Only a *null* skill set means "no student". A student with an empty skill set
    // still scores 0 against listings that require skills, which outranks -1.
    private static IQueryable<Internship> OrderForStudent(IQueryable<Internship> query, int[]? studentSkillIds) =>
        studentSkillIds is null
            ? query.OrderByDescending(i => i.CreatedAtUtc).ThenByDescending(i => i.Id)
            : query
                .OrderByDescending(i => i.RequiredSkills.Count == 0
                    ? -1d
                    : i.RequiredSkills.Count(rs => studentSkillIds.Contains(rs.SkillId)) * 100.0 / i.RequiredSkills.Count)
                .ThenByDescending(i => i.CreatedAtUtc)
                .ThenByDescending(i => i.Id);

    public async Task<Internship?> GetWithCompanyAsync(int id, CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .Include(i => i.Company)
            .Include(i => i.RequiredSkills)
                .ThenInclude(rs => rs.Skill)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
    }

    public async Task<Internship?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .AsNoTracking()
            .Include(i => i.Company)
            .Include(i => i.RequiredSkills)
                .ThenInclude(rs => rs.Skill)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Internship>> GetByIdsAsync(IReadOnlyCollection<int> ids, CancellationToken cancellationToken = default)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        return await Context.Internships
            .AsNoTracking()
            .Include(i => i.Company)
            .Include(i => i.RequiredSkills)
                .ThenInclude(rs => rs.Skill)
            .Where(i => ids.Contains(i.Id))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Internship>> GetPopularActiveAsync(int take, CancellationToken cancellationToken = default)
    {
        return await Context.Internships
            .AsNoTracking()
            .Include(i => i.Company)
            .Include(i => i.RequiredSkills)
                .ThenInclude(rs => rs.Skill)
            .Where(i => i.IsActive)
            .OrderByDescending(i => i.Applications.Count)
            .ThenByDescending(i => i.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);
    }
}
