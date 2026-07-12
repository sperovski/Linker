namespace Linker.Application.Common.Interfaces;

/// <summary>An uploaded CV read back from storage, ready to stream to an authorised caller.</summary>
public sealed record CvFileContent(byte[] Content, string ContentType, string FileName);

/// <summary>
/// Persists uploaded CV files. Files are never served directly — a CV contains
/// personal data, so it's streamed only through an authenticated endpoint that
/// checks the caller is allowed to see it (see IStudentService.GetCvFileAsync).
/// </summary>
public interface ICvFileStorage
{
    Task<string> SaveAsync(int studentId, string fileName, byte[] content, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reads a managed upload back, or null if <paramref name="url"/> is not a file this class
    /// manages (e.g. an external link the student pasted) or the file is missing.
    /// </summary>
    Task<CvFileContent?> OpenAsync(string? url, CancellationToken cancellationToken = default);

    /// <summary>True when <paramref name="url"/> points at a file this class manages, rather than an external link.</summary>
    bool IsManaged(string? url);

    /// <summary>
    /// Deletes the previous file if — and only if — <paramref name="url"/> points at storage this
    /// class manages. A student's CvUrl might instead be an external link they pasted in, which
    /// must never be touched.
    /// </summary>
    void DeleteIfManaged(string? url);
}
