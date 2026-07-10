namespace Linker.Application.Common.Interfaces;

/// <summary>Persists an uploaded CV file and returns a URL the frontend can link to directly.</summary>
public interface ICvFileStorage
{
    Task<string> SaveAsync(int studentId, string fileName, byte[] content, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes the previous file if — and only if — <paramref name="url"/> points at storage this
    /// class manages. A student's CvUrl might instead be an external link they pasted in, which
    /// must never be touched.
    /// </summary>
    void DeleteIfManaged(string? url);
}
