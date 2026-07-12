using Linker.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Linker.Infrastructure.Storage;

/// <summary>
/// Stores CV uploads on local disk under a persisted volume (see docker-compose.yml /
/// fly.api.toml). Files are never exposed as static content — they hold personal data,
/// so they're read back only via OpenAsync and streamed through an authenticated,
/// ownership-checked endpoint. One folder per student keeps the tree small.
/// </summary>
public class LocalCvFileStorage : ICvFileStorage
{
    private const string RequestPrefix = "/uploads/cvs/";

    private static readonly IReadOnlyDictionary<string, string> ContentTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    private readonly string _root;

    public LocalCvFileStorage(IConfiguration configuration)
    {
        var uploadsPath = configuration["Storage:UploadsPath"] ?? "uploads";
        _root = Path.Combine(Directory.GetCurrentDirectory(), uploadsPath, "cvs");
    }

    public async Task<string> SaveAsync(int studentId, string fileName, byte[] content, CancellationToken cancellationToken = default)
    {
        var studentDir = Path.Combine(_root, studentId.ToString());
        Directory.CreateDirectory(studentDir);

        var extension = Path.GetExtension(fileName);
        var storedName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(studentDir, storedName);

        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);

        return $"{RequestPrefix}{studentId}/{storedName}";
    }

    public bool IsManaged(string? url) =>
        !string.IsNullOrWhiteSpace(url) && url.StartsWith(RequestPrefix, StringComparison.Ordinal);

    public async Task<CvFileContent?> OpenAsync(string? url, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveManagedPath(url);
        if (fullPath is null || !File.Exists(fullPath))
        {
            return null;
        }

        var extension = Path.GetExtension(fullPath);
        var contentType = ContentTypes.TryGetValue(extension, out var ct) ? ct : "application/octet-stream";
        var content = await File.ReadAllBytesAsync(fullPath, cancellationToken);
        return new CvFileContent(content, contentType, $"cv{extension}");
    }

    public void DeleteIfManaged(string? url)
    {
        var fullPath = ResolveManagedPath(url);
        if (fullPath is not null && File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
    }

    /// <summary>
    /// Maps a managed "/uploads/cvs/..." URL to an absolute path, or null if the URL isn't managed
    /// or resolves outside the uploads root (guards against a crafted "../../" path).
    /// </summary>
    private string? ResolveManagedPath(string? url)
    {
        if (!IsManaged(url))
        {
            return null;
        }

        var relative = url![RequestPrefix.Length..].Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_root, relative));

        return fullPath.StartsWith(Path.GetFullPath(_root) + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            ? fullPath
            : null;
    }
}
