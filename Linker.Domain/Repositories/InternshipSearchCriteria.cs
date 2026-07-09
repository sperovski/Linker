using Linker.Domain.Enums;

namespace Linker.Domain.Repositories;

/// <summary>
/// Filters applied to the public internship search. Every member is optional;
/// a criteria with all-null members matches every active listing.
/// </summary>
public sealed record InternshipSearchCriteria(
    string? Location = null,
    string? SearchText = null,
    InternshipType? Type = null,
    string? Company = null);

/// <summary>Open-role count for a single company within a search result set.</summary>
public sealed record CompanyRoleCount(string Name, int Count);
