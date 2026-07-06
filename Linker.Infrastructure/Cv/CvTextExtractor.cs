using System.Text;
using DocumentFormat.OpenXml.Packaging;
using Linker.Application.Common.Exceptions;
using Linker.Application.Services;
using UglyToad.PdfPig;

namespace Linker.Infrastructure.Cv;

public class CvTextExtractor : ICvTextExtractor
{
    public string Extract(byte[] content, string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();

        var text = extension switch
        {
            ".pdf" => ExtractPdf(content),
            ".docx" => ExtractDocx(content),
            ".txt" or ".text" or ".md" => Encoding.UTF8.GetString(content),
            _ => throw new BadRequestException(
                "Unsupported file type. Upload a PDF, DOCX or TXT file, or paste your CV text.")
        };

        text = Normalize(text);

        // Image-only/scanned PDFs yield little or no extractable text.
        if (text.Length < 50)
        {
            throw new BadRequestException(
                "We couldn't read enough text from that file — it may be a scanned image. Try a text-based PDF/DOCX, or paste the text instead.");
        }

        return text;
    }

    private static string ExtractPdf(byte[] content)
    {
        try
        {
            using var stream = new MemoryStream(content);
            using var document = PdfDocument.Open(stream);
            var builder = new StringBuilder();
            foreach (var page in document.GetPages())
            {
                builder.AppendLine(page.Text);
            }

            return builder.ToString();
        }
        catch (BadRequestException)
        {
            throw;
        }
        catch (Exception)
        {
            throw new BadRequestException("That PDF could not be read. Try re-exporting it, or paste the text instead.");
        }
    }

    private static string ExtractDocx(byte[] content)
    {
        try
        {
            using var stream = new MemoryStream(content);
            using var document = WordprocessingDocument.Open(stream, false);
            return document.MainDocumentPart?.Document?.Body?.InnerText ?? string.Empty;
        }
        catch (Exception)
        {
            throw new BadRequestException("That DOCX could not be read. Try saving it as PDF, or paste the text instead.");
        }
    }

    // PdfPig concatenates page text without spaces at line breaks; collapse runs
    // of whitespace so word counting and skill detection behave.
    private static string Normalize(string text)
    {
        var normalized = text.Replace(' ', ' ');
        var builder = new StringBuilder(normalized.Length);
        var lastWasSpace = false;
        foreach (var ch in normalized)
        {
            if (char.IsWhiteSpace(ch))
            {
                if (!lastWasSpace)
                {
                    builder.Append(' ');
                    lastWasSpace = true;
                }
            }
            else
            {
                builder.Append(ch);
                lastWasSpace = false;
            }
        }

        return builder.ToString().Trim();
    }
}
