using System.Text;
using System.Text.Json;
using Linker.Application.DTOs.Cv;
using Linker.Application.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Linker.Infrastructure.Ai;

/// <summary>
/// CV reviewer backed by the Anthropic Messages API. Skill matching stays
/// deterministic (via the heuristic analyser); the language model supplies the
/// score, summary and qualitative feedback. Any failure falls back cleanly to
/// the fully-offline heuristic result so the endpoint never hard-fails.
/// </summary>
public class ClaudeCvReviewService : ICvReviewService
{
    private readonly HttpClient _httpClient;
    private readonly HeuristicCvReviewService _fallback;
    private readonly ILogger<ClaudeCvReviewService> _logger;
    private readonly string _apiKey;
    private readonly string _model;

    public ClaudeCvReviewService(
        HttpClient httpClient,
        HeuristicCvReviewService fallback,
        IConfiguration configuration,
        ILogger<ClaudeCvReviewService> logger)
    {
        _httpClient = httpClient;
        _fallback = fallback;
        _logger = logger;
        _apiKey = configuration["Anthropic:ApiKey"] ?? string.Empty;
        _model = configuration["Anthropic:Model"] ?? "claude-sonnet-5";
    }

    public async Task<CvReviewResponse> ReviewAsync(int userId, CvReviewRequest request, CancellationToken cancellationToken = default)
    {
        // Deterministic skill match + a guaranteed fallback result.
        var analysis = await _fallback.AnalyzeAsync(request, cancellationToken);

        try
        {
            var ai = await CallClaudeAsync(request, analysis, cancellationToken);
            if (ai is not null)
            {
                return new CvReviewResponse(
                    Math.Clamp(ai.Score, 5, 99),
                    ai.Summary,
                    ai.Strengths,
                    ai.Improvements,
                    analysis.MatchedSkills,
                    analysis.MissingSkills,
                    analysis.TargetRole,
                    analysis.RoleFit,
                    "ai");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Claude CV review failed; falling back to heuristic analyser.");
        }

        return analysis.ToResponse("heuristic");
    }

    private async Task<AiFeedback?> CallClaudeAsync(CvReviewRequest request, CvAnalysis analysis, CancellationToken cancellationToken)
    {
        var roleContext = analysis.TargetRole is null
            ? "The candidate has not chosen a target role."
            : $"Target role: \"{analysis.TargetRole}\". Required skills: {(analysis.MatchedSkills.Concat(analysis.MissingSkills).Any() ? string.Join(", ", analysis.MatchedSkills.Concat(analysis.MissingSkills)) : "unspecified")}.";

        var prompt =
            $$"""
            You are a supportive but honest career coach reviewing a student's CV for internships.
            {{roleContext}}

            Return ONLY minified JSON with this exact shape:
            {"score": <integer 0-100>, "summary": "<=2 sentences", "strengths": ["..."], "improvements": ["..."]}
            Give 2-4 strengths and 2-4 concrete, actionable improvements. Be specific to the CV.

            CV:
            ---
            {{request.CvText}}
            ---
            """;

        var payload = new
        {
            model = _model,
            max_tokens = 1024,
            messages = new[] { new { role = "user", content = prompt } }
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        httpRequest.Headers.Add("x-api-key", _apiKey);
        httpRequest.Headers.Add("anthropic-version", "2023-06-01");
        httpRequest.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        var text = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var json = ExtractJson(text);
        return json is null ? null : JsonSerializer.Deserialize<AiFeedback>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
    }

    // Models occasionally wrap JSON in prose or code fences; grab the outermost object.
    private static string? ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        return start >= 0 && end > start ? text[start..(end + 1)] : null;
    }

    private sealed record AiFeedback(int Score, string Summary, List<string> Strengths, List<string> Improvements);
}
