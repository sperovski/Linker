using System.IO.Compression;
using System.Text;
using Linker.Application.Common.Exceptions;
using Linker.Infrastructure.Cv;

namespace Linker.Application.Tests;

/// <summary>
/// The CV extractor parses attacker-supplied DOCX/PDF files. A DOCX is a zip of
/// XML parts, so the classic risk is XXE: a document.xml that declares an
/// external entity pointing at a local file, hoping the parser resolves it and
/// folds the file's contents into the extracted text (which the app then stores
/// on the profile and can surface to companies).
///
/// These tests prove the secret never reaches the output — whether the parser
/// rejects the DTD outright or simply refuses to resolve the entity.
/// </summary>
public class CvTextExtractorSecurityTests : IDisposable
{
    private readonly CvTextExtractor _extractor = new();
    private readonly string _secretPath;
    private const string SecretMarker = "S3CRET-a1b2c3d4e5f6-DO-NOT-LEAK";

    public CvTextExtractorSecurityTests()
    {
        // A real on-disk file the XXE payload will try to exfiltrate.
        _secretPath = Path.Combine(Path.GetTempPath(), $"xxe-secret-{Guid.NewGuid():N}.txt");
        File.WriteAllText(_secretPath, SecretMarker);
    }

    public void Dispose()
    {
        if (File.Exists(_secretPath))
        {
            File.Delete(_secretPath);
        }
    }

    /// <summary>Builds a minimal DOCX whose document body is <paramref name="bodyXml"/>.</summary>
    private static byte[] BuildDocx(string documentXml)
    {
        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            void Add(string path, string content)
            {
                var entry = zip.CreateEntry(path);
                using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
                writer.Write(content);
            }

            Add("[Content_Types].xml",
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                </Types>
                """);

            Add("_rels/.rels",
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
                </Relationships>
                """);

            Add("word/document.xml", documentXml);
        }

        return ms.ToArray();
    }

    private string DocumentWithExternalEntity()
    {
        // file:// URI to the secret, pulled in via a SYSTEM external entity and
        // referenced from a run's text so it would land in InnerText if resolved.
        var uri = new Uri(_secretPath).AbsoluteUri;
        return $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE w:document [ <!ENTITY xxe SYSTEM "{uri}"> ]>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:r><w:t>Skills: Angular, C#. Education at Test University. Worked as an intern. &xxe;</w:t></w:r></w:p>
              </w:body>
            </w:document>
            """;
    }

    [Fact]
    public void Docx_WithExternalEntity_NeverLeaksTheReferencedFile()
    {
        var docx = BuildDocx(DocumentWithExternalEntity());

        // The extractor may reject the DTD (BadRequestException) or read the doc
        // with the entity unresolved. Either is safe; a leak is the only failure.
        string? extracted = null;
        try
        {
            extracted = _extractor.Extract(docx, "resume.docx");
        }
        catch (BadRequestException)
        {
            // Parser refused the DTD-bearing document — no text, no leak.
        }

        if (extracted is not null)
        {
            Assert.DoesNotContain(SecretMarker, extracted);
        }

        // The file's own bytes are untouched regardless.
        Assert.Equal(SecretMarker, File.ReadAllText(_secretPath));
    }

    [Fact]
    public void Docx_Control_WithoutPayload_ParsesAndReturnsItsText()
    {
        // Proves the fixture builder produces a genuinely valid DOCX, so the
        // XXE tests are exercising the entity handling — not passing because a
        // malformed document happened to fail for an unrelated reason.
        var benign = """
            <?xml version="1.0" encoding="UTF-8"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:r><w:t>Skills: Angular, C#. Education at Test University. Worked as an intern.</w:t></w:r></w:p>
              </w:body>
            </w:document>
            """;

        var text = _extractor.Extract(BuildDocx(benign), "resume.docx");

        Assert.Contains("Angular", text);
        Assert.Contains("Test University", text);
    }

    [Fact]
    public void Docx_WithExternalEntity_ForCvTextField_NeverLeaks()
    {
        // Same payload, but assert specifically that even a "successful" parse
        // path cannot smuggle the secret into the returned CV text.
        var docx = BuildDocx(DocumentWithExternalEntity());

        try
        {
            var text = _extractor.Extract(docx, "resume.docx");
            Assert.DoesNotContain("S3CRET", text);
        }
        catch (BadRequestException)
        {
            // Rejected outright — also safe.
        }
    }
}
