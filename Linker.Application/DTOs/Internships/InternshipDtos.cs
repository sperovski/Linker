using System.ComponentModel.DataAnnotations;
using Linker.Application.DTOs.Common;
using Linker.Application.DTOs.Skills;

namespace Linker.Application.DTOs.Internships;

public record CreateInternshipRequest(
    [Required, MaxLength(200)] string Title,
    [Required, MaxLength(8000)] string Description,
    [MaxLength(200)] string? Location,
    [Required] string Type,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateOnly? ApplicationDeadline,
    IReadOnlyList<int>? SkillIds);

public record UpdateInternshipRequest(
    [Required, MaxLength(200)] string Title,
    [Required, MaxLength(8000)] string Description,
    [MaxLength(200)] string? Location,
    [Required] string Type,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateOnly? ApplicationDeadline,
    IReadOnlyList<int>? SkillIds);

public record InternshipSearchRequest(
    string? Location,
    string? SearchText,
    string? Type,
    string? Company = null,
    int Page = 1,
    int PageSize = Paging.DefaultPageSize)
{
    public InternshipSearchRequest Normalized()
    {
        var (page, pageSize) = Paging.Normalize(Page, PageSize);
        return this with { Page = page, PageSize = pageSize };
    }
}

/// <summary>A company appearing in a search result set, with its open-role count.</summary>
public record CompanyFacet(string Name, int Count);

/// <summary>A page of search results plus the company facet for the whole result set.</summary>
public record InternshipSearchResponse(
    IReadOnlyList<InternshipListItemResponse> Items,
    int Total,
    int Page,
    int PageSize,
    IReadOnlyList<CompanyFacet> Companies)
    : PagedResponse<InternshipListItemResponse>(Items, Total, Page, PageSize);

public record InternshipListItemResponse(
    int Id,
    string Title,
    string? Location,
    string Type,
    string CompanyName,
    bool IsActive,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateOnly? ApplicationDeadline,
    IReadOnlyList<SkillResponse> RequiredSkills,
    int? MatchScore,
    bool IsSaved,
    // Explainability behind MatchScore, so the card can say "You have 2 of 3
    // required skills" without recomputing the match client-side. Both null
    // when there is no student context.
    int? MatchedSkillCount,
    int? RequiredSkillCount,
    // True when the caller has already applied. Suppresses the match badge on
    // rails that don't exclude applied roles (Trending), which otherwise show a
    // high score for a role Recommended has deliberately dropped.
    bool HasApplied);

public record InternshipDetailResponse(
    int Id,
    int CompanyId,
    string CompanyName,
    string Title,
    string Description,
    string? Location,
    string Type,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateOnly? ApplicationDeadline,
    bool IsActive,
    DateTime CreatedAtUtc,
    IReadOnlyList<SkillResponse> RequiredSkills,
    int? MatchScore,
    bool IsSaved);
