namespace Linker.Application.DTOs.Common;

/// <summary>Bounds for every paged endpoint. Query-string values are untrusted.</summary>
public static class Paging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;

    /// <summary>Folds a caller-supplied page/pageSize into a safe range.</summary>
    public static (int Page, int PageSize) Normalize(int page, int pageSize) => (
        page < 1 ? 1 : page,
        pageSize is < 1 or > MaxPageSize ? DefaultPageSize : pageSize);
}
