using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Cv;

public record CvReviewRequest(
    [Required, MinLength(50), MaxLength(20000)] string CvText,
    int? InternshipId);

// Returned by the file-upload flow: the text we managed to read plus its review,
// so the UI can show what was scanned and let the student edit and re-rate.
public record CvFileReviewResponse(
    string ExtractedText,
    string FileName,
    CvReviewResponse Review);

public record CvReviewResponse(
    int Score,
    string Summary,
    IReadOnlyList<string> Strengths,
    IReadOnlyList<string> Improvements,
    IReadOnlyList<string> MatchedSkills,
    IReadOnlyList<string> MissingSkills,
    string? TargetRole,
    // How well the CV fits the chosen role (0-100); null for a general review.
    int? RoleFit,
    // "ai" when produced by a language model, "heuristic" for the built-in analyser.
    string Source);
