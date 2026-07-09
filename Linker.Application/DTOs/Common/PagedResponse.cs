namespace Linker.Application.DTOs.Common;

/// <summary>One page of results plus the total matching the query across all pages.</summary>
public record PagedResponse<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
