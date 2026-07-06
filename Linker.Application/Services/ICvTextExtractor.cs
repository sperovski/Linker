namespace Linker.Application.Services;

/// <summary>
/// Extracts plain text from an uploaded CV file (PDF, DOCX or TXT). Throws a
/// BadRequestException for unsupported types or files no text can be read from
/// (e.g. a scanned, image-only PDF).
/// </summary>
public interface ICvTextExtractor
{
    string Extract(byte[] content, string fileName);
}
