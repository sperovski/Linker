using Linker.Domain.Entities;
using Linker.Domain.Enums;

namespace Linker.Domain.Repositories;

public interface IInternshipRepository : IRepository<Internship>
{
    Task<IReadOnlyList<Internship>> GetByCompanyAsync(int companyId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetActiveAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetAllWithCompanyAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// One page of active listings matching <paramref name="criteria"/>, ordered by how well
    /// they match <paramref name="studentSkillIds"/> (best first) then by recency. Pass a null
    /// or empty <paramref name="studentSkillIds"/> for anonymous callers to get recency order.
    /// </summary>
    Task<(IReadOnlyList<Internship> Items, int Total)> SearchActiveAsync(
        InternshipSearchCriteria criteria,
        int[]? studentSkillIds,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The <paramref name="take"/> best-matching active listings for a student: those sharing at
    /// least one skill, excluding any they have already applied to. Scored and ordered in SQL.
    /// </summary>
    Task<IReadOnlyList<Internship>> GetRecommendedForStudentAsync(
        int studentId, int[] studentSkillIds, int take, CancellationToken cancellationToken = default);

    /// <summary>
    /// Open-role counts per company across the whole result set for <paramref name="criteria"/>.
    /// The caller is expected to clear <see cref="InternshipSearchCriteria.Company"/> first so the
    /// facet does not collapse to the company already selected.
    /// </summary>
    Task<IReadOnlyList<CompanyRoleCount>> GetCompanyFacetsAsync(
        InternshipSearchCriteria criteria, CancellationToken cancellationToken = default);
    Task<Internship?> GetWithCompanyAsync(int id, CancellationToken cancellationToken = default);
    Task<Internship?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetByIdsAsync(IReadOnlyCollection<int> ids, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Internship>> GetPopularActiveAsync(int take, CancellationToken cancellationToken = default);
}
