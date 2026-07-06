using System.Text.RegularExpressions;
using Linker.Application.Common;
using Linker.Application.DTOs.Cv;
using Linker.Domain.Repositories;

namespace Linker.Application.Services;

/// <summary>
/// Rule-based CV reviewer. Runs entirely offline and is the default backend when
/// no language-model API key is configured. When a target role is chosen it reads
/// that internship's required skills and description and scores/critiques the CV
/// specifically against that position; otherwise it does a general CV review.
/// </summary>
public class HeuristicCvReviewService : ICvReviewService
{
    private readonly ISkillRepository _skillRepository;
    private readonly IInternshipRepository _internshipRepository;

    private static readonly string[] ActionVerbs =
    [
        "built", "designed", "developed", "led", "created", "implemented", "improved",
        "launched", "managed", "delivered", "automated", "optimized", "optimised",
        "analyzed", "analysed", "collaborated", "shipped", "reduced", "increased"
    ];

    // Recruiting boilerplate and generic terms that carry no signal when matching
    // a CV against a job description.
    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "about", "above", "across", "after", "against", "along", "already", "also", "among", "another",
        "apply", "application", "around", "become", "been", "before", "being", "below", "between", "both",
        "build", "building", "career", "chance", "close", "closely", "collaborate", "company", "could",
        "daily", "days", "developing", "development", "different", "during", "each", "either", "environment",
        "every", "experience", "flexible", "focus", "friendly", "from", "full", "future", "great", "grow",
        "growth", "hands", "have", "having", "help", "helping", "here", "hybrid", "ideal", "including",
        "internship", "into", "join", "joining", "knowledge", "learn", "learning", "looking", "macedonia",
        "modern", "month", "months", "motivated", "must", "nice", "office", "onboarding", "opportunity",
        "other", "over", "paid", "part", "passion", "passionate", "people", "plus", "position", "practical",
        "process", "product", "project", "projects", "provide", "real", "remote", "responsible", "role",
        "skills", "skopje", "software", "some", "strong", "student", "students", "support", "supporting",
        "team", "technologies", "that", "their", "them", "then", "there", "these", "they", "this", "those",
        "through", "time", "together", "tools", "under", "using", "want", "week", "weeks", "well", "what",
        "when", "where", "which", "while", "will", "with", "within", "work", "working", "world", "would",
        "years", "your", "youll",
        "alongside", "engineer", "engineers", "senior", "junior", "various", "several", "essential",
        "responsibilities", "requirements", "candidate", "candidates", "please", "excellent", "understanding",
        "familiar", "familiarity", "basic", "based", "platform", "systems", "system", "solutions",
        "linker"
    };

    public HeuristicCvReviewService(ISkillRepository skillRepository, IInternshipRepository internshipRepository)
    {
        _skillRepository = skillRepository;
        _internshipRepository = internshipRepository;
    }

    public async Task<CvReviewResponse> ReviewAsync(int userId, CvReviewRequest request, CancellationToken cancellationToken = default)
    {
        var analysis = await AnalyzeAsync(request, cancellationToken);
        return analysis.ToResponse("heuristic");
    }

    // Shared analysis used both here and as the AI reviewer's deterministic
    // skill/fallback source.
    public async Task<CvAnalysis> AnalyzeAsync(CvReviewRequest request, CancellationToken cancellationToken)
    {
        var text = request.CvText;
        var wordCount = Regex.Matches(text, @"\b[\w'-]+\b").Count;

        var knownSkills = (await _skillRepository.GetAllAsync(cancellationToken)).Select(s => s.Name).ToList();
        var detected = CvSkillMatcher.DetectSkills(text, knownSkills);

        // --- Resolve the target position (if any) -----------------------------
        string? targetRole = null;
        string? companyName = null;
        string? roleType = null;
        IReadOnlyList<string> requiredSkills = [];
        IReadOnlyList<string> roleKeywords = [];
        if (request.InternshipId is { } internshipId)
        {
            var internship = await _internshipRepository.GetWithDetailsAsync(internshipId, cancellationToken);
            if (internship is not null)
            {
                targetRole = internship.Title;
                companyName = internship.Company?.Name;
                roleType = internship.Type.ToString();
                requiredSkills = internship.RequiredSkills
                    .Where(rs => rs.Skill is not null)
                    .Select(rs => rs.Skill.Name)
                    .ToList();
                roleKeywords = ExtractRoleKeywords(internship.Title, internship.Description, companyName, requiredSkills, knownSkills);
            }
        }

        var isTargeted = targetRole is not null;

        var matchedSkills = requiredSkills.Count > 0
            ? requiredSkills.Where(detected.Contains).ToList()
            : detected;
        var missingSkills = requiredSkills.Where(r => !detected.Contains(r)).ToList();

        // Which of the role's own description terms the CV actually echoes.
        var matchedKeywords = roleKeywords.Where(k => text.Contains(k, StringComparison.OrdinalIgnoreCase)).ToList();
        var missingKeywords = roleKeywords.Where(k => !matchedKeywords.Contains(k)).ToList();

        // --- Structure signals ------------------------------------------------
        var hasEducation = ContainsAny(text, "education", "university", "faculty", "bachelor", "b.sc", "degree", "студ", "факултет");
        var hasExperience = ContainsAny(text, "experience", "intern", "worked", "employ", "company", "role at");
        var hasProjects = ContainsAny(text, "project", "portfolio", "github", "built", "developed");
        var hasContact = Regex.IsMatch(text, @"[\w.+-]+@[\w-]+\.[\w.-]+") || Regex.IsMatch(text, @"\+?\d[\d\s().-]{7,}");
        var hasSkillsSection = ContainsAny(text, "skills", "technologies", "tech stack", "tools");
        var hasQuantified = Regex.IsMatch(text, @"\d+\s?%|\b\d{2,}\b");
        var actionVerbCount = ActionVerbs.Count(v => text.Contains(v, StringComparison.OrdinalIgnoreCase));

        // --- Role fit ---------------------------------------------------------
        // How well the CV matches THIS specific position: required-skill coverage
        // weighted most, backed by how much of the role's own wording it echoes.
        int? roleFit = null;
        if (isTargeted)
        {
            double? skillPct = requiredSkills.Count > 0
                ? matchedSkills.Count * 100.0 / requiredSkills.Count
                : null;
            double? keywordPct = roleKeywords.Count > 0
                ? matchedKeywords.Count * 100.0 / roleKeywords.Count
                : null;

            roleFit = (skillPct, keywordPct) switch
            {
                ({ } s, { } k) => (int)Math.Round(s * 0.7 + k * 0.3),
                ({ } s, null) => (int)Math.Round(s),
                (null, { } k) => (int)Math.Round(k),
                _ => 0
            };
        }

        // --- Scoring ----------------------------------------------------------
        var score = 35;
        if (hasEducation) score += 6;
        if (hasExperience) score += 8;
        if (hasProjects) score += 6;
        if (hasContact) score += 4;
        if (hasSkillsSection) score += 3;
        if (hasQuantified) score += 7;
        if (actionVerbCount >= 3) score += 5;
        else if (actionVerbCount >= 1) score += 3;

        if (isTargeted)
        {
            // Targeted review is dominated by how well the CV fits the role.
            score += (int)Math.Round((roleFit ?? 0) * 0.30); // up to +30
        }
        else
        {
            score += Math.Min(detected.Count, 6) * 2; // up to +12 for skill breadth
        }

        // Length adequacy: reward a focused 150-800 word CV.
        if (wordCount is >= 150 and <= 800) score += 6;
        else if (wordCount < 100) score -= 8;

        score = Math.Clamp(score, 5, 99);

        // --- Narrative feedback ----------------------------------------------
        var strengths = BuildStrengths(isTargeted, targetRole, matchedSkills, matchedKeywords, hasExperience, hasProjects, hasQuantified, actionVerbCount);
        var improvements = BuildImprovements(isTargeted, targetRole, missingSkills, missingKeywords, hasQuantified, hasProjects, hasContact, hasEducation, actionVerbCount, wordCount);
        var summary = BuildSummary(score, targetRole, companyName, roleType, roleFit, matchedSkills.Count, requiredSkills.Count);

        return new CvAnalysis(score, summary, strengths, improvements, matchedSkills, missingSkills, targetRole, roleFit);
    }

    private static List<string> BuildStrengths(
        bool isTargeted, string? targetRole, IReadOnlyList<string> matchedSkills, IReadOnlyList<string> matchedKeywords,
        bool hasExperience, bool hasProjects, bool hasQuantified, int actionVerbCount)
    {
        var strengths = new List<string>();

        if (matchedSkills.Count > 0)
        {
            strengths.Add(isTargeted
                ? $"Covers {matchedSkills.Count} of \"{targetRole}\"'s required skills: {string.Join(", ", matchedSkills.Take(6))}."
                : $"Mentions {matchedSkills.Count} relevant skill{(matchedSkills.Count == 1 ? "" : "s")}: {string.Join(", ", matchedSkills.Take(6))}.");
        }

        if (isTargeted && matchedKeywords.Count > 0)
        {
            strengths.Add($"Echoes the role's own language: {string.Join(", ", matchedKeywords.Take(5))}.");
        }

        if (hasExperience) strengths.Add("Includes real experience — internships or work history stand out to reviewers.");
        if (hasProjects) strengths.Add("References projects or a portfolio, which shows applied ability.");
        if (hasQuantified) strengths.Add("Uses numbers to quantify impact, which makes achievements concrete.");
        if (actionVerbCount >= 3) strengths.Add("Strong action verbs give the writing momentum.");
        if (strengths.Count == 0) strengths.Add("You've made a start — build on the fundamentals below.");

        return strengths.Take(4).ToList();
    }

    private static List<string> BuildImprovements(
        bool isTargeted, string? targetRole, IReadOnlyList<string> missingSkills, IReadOnlyList<string> missingKeywords,
        bool hasQuantified, bool hasProjects, bool hasContact, bool hasEducation, int actionVerbCount, int wordCount)
    {
        var improvements = new List<string>();

        if (isTargeted && missingSkills.Count > 0)
            improvements.Add($"\"{targetRole}\" asks for {string.Join(", ", missingSkills.Take(6))} — add concrete evidence if you have it.");

        if (isTargeted && missingKeywords.Count > 0)
            improvements.Add($"The posting emphasises {string.Join(", ", missingKeywords.Take(4))}; mirror that wording where it's genuinely true of you.");

        if (!hasQuantified)
            improvements.Add("Quantify results (e.g. \"cut load time by 40%\") instead of listing duties.");
        if (!hasProjects)
            improvements.Add("Add a projects section with links — it's the fastest way to prove skill for internships.");
        if (!hasContact)
            improvements.Add("Include clear contact details (email and phone) near the top.");
        if (!hasEducation)
            improvements.Add("State your education — degree, university and expected graduation.");
        if (actionVerbCount < 3)
            improvements.Add("Start bullet points with action verbs (built, led, designed) rather than \"responsible for\".");
        if (wordCount < 100)
            improvements.Add("The CV looks short — expand on what you did and the outcome for each entry.");
        if (improvements.Count == 0)
            improvements.Add("Tighten wording and keep the strongest, most recent items near the top.");

        return improvements.Take(4).ToList();
    }

    private static string BuildSummary(int score, string? targetRole, string? companyName, string? roleType, int? roleFit, int matched, int required)
    {
        var band = score switch
        {
            >= 80 => "strong",
            >= 60 => "solid",
            >= 40 => "promising but underdeveloped",
            _ => "early-stage"
        };

        if (targetRole is null)
        {
            return $"Overall this CV looks {band}. Focus on the improvements below to lift the score.";
        }

        var fitBand = roleFit switch
        {
            >= 75 => "a strong fit",
            >= 50 => "a partial fit",
            >= 25 => "a weak fit",
            _ => "not yet a fit"
        };

        var at = companyName is null ? "" : $" at {companyName}";
        var skillNote = required > 0 ? $" — you cover {matched}/{required} required skills" : "";
        var typeNote = roleType is null ? "" : $" This is a {FormatType(roleType)} role.";

        return $"Against \"{targetRole}\"{at}, this CV is {fitBand} ({roleFit}%){skillNote}. As a general CV it reads {band}.{typeNote} Work the role-specific gaps below.";
    }

    private static string FormatType(string type) => type switch
    {
        "PartTime" => "part-time",
        "FullTime" => "full-time",
        _ => "internship"
    };

    // Pulls the most salient, repeated terms out of a job posting — the words a
    // reviewer would expect to see reflected in a matching CV.
    private static IReadOnlyList<string> ExtractRoleKeywords(
        string title, string description, string? companyName, IEnumerable<string> requiredSkills, IEnumerable<string> knownSkills)
    {
        // Company/product name tokens are noise when matching a personal CV.
        var companyTokens = companyName is null
            ? Enumerable.Empty<string>()
            : Regex.Matches(companyName.ToLowerInvariant(), @"[a-z]{3,}").Select(m => m.Value);

        var exclude = new HashSet<string>(
            requiredSkills.Concat(knownSkills).Select(s => s.ToLowerInvariant()).Concat(companyTokens),
            StringComparer.OrdinalIgnoreCase);

        var source = $"{title} {title} {description}".ToLowerInvariant();

        return Regex.Matches(source, @"[a-z][a-z+#.-]{4,}")
            .Select(m => m.Value.Trim('.', '-', '+', '#'))
            .Where(w => w.Length >= 5 && !StopWords.Contains(w) && !exclude.Contains(w))
            .GroupBy(w => w)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .Select(g => g.Key)
            .Take(12)
            .ToList();
    }

    private static bool ContainsAny(string text, params string[] needles) =>
        needles.Any(n => text.Contains(n, StringComparison.OrdinalIgnoreCase));
}

public record CvAnalysis(
    int Score,
    string Summary,
    IReadOnlyList<string> Strengths,
    IReadOnlyList<string> Improvements,
    IReadOnlyList<string> MatchedSkills,
    IReadOnlyList<string> MissingSkills,
    string? TargetRole,
    int? RoleFit)
{
    public CvReviewResponse ToResponse(string source) =>
        new(Score, Summary, Strengths, Improvements, MatchedSkills, MissingSkills, TargetRole, RoleFit, source);
}
