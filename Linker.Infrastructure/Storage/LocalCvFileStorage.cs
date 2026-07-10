using Linker.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Linker.Infrastructure.Storage;

/// <summary>
/// Stores CV uploads on local disk under a persisted volume (see docker-compose.yml /
/// fly.api.toml) and serves them back via app.UseStaticFiles in Program.cs at the same
/// "/uploads" prefix used here. One folder per student, so re-uploading only ever grows a
/// small, easily-cleaned tree.
/// </summary>
public class LocalCvFileStorage : ICvFileStorage
{
    private const string RequestPrefix = "/uploads/cvs/";

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

    public void DeleteIfManaged(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith(RequestPrefix, StringComparison.Ordinal))
        {
            return;
        }

        var relative = url[RequestPrefix.Length..].Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(_root, relative);

        // Guard against a crafted "../../" URL escaping the uploads root.
        if (!Path.GetFullPath(fullPath).StartsWith(Path.GetFullPath(_root), StringComparison.Ordinal))
        {
            return;
        }

        File.Delete(fullPath);
    }
}
