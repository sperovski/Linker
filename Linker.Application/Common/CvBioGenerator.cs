using System.Text.RegularExpressions;

namespace Linker.Application.Common;

/// <summary>
/// Composes a short profile bio from a CV.
///
/// Deliberately conservative: every clause is built from something actually
/// found in the text (an institution, a field of study, detected skills, an
/// experience signal). Anything it can't identify is left out rather than
/// guessed at, so the bio never claims something the CV doesn't say. Returns
/// null when it finds too little to say anything worth showing.
/// </summary>
public static class CvBioGenerator
{
    private const int MaxSkillsInBio = 6;

    // A name word. Deliberately excludes '.' so a match can't run past a
    // sentence boundary and swallow the start of the next sentence
    // ("...and Engineering. Built things" must stop at "Engineering").
    private const string Word = @"[A-Z][\w'’-]*";

    // Lowercase joiners that appear inside proper names ("Cyril and Methodius").
    private const string Joiner = @"(?:and|of|for|the)";

    // An optional leading abbreviation, e.g. the "Ss." in "Ss. Cyril and
    // Methodius University".
    private const string Abbrev = @"(?:[A-Z][a-z]{0,2}\.\s+)?";

    // Longest-first: "Faculty of X" and "University of X" should win over a bare
    // "<Name> University" match on the same line.
    private static readonly string[] InstitutionPatterns =
    [
        $@"(?:Faculty|School|Institute)\s+of\s+{Word}(?:\s+(?:{Joiner}|{Word})){{0,5}}",
        $@"University\s+of\s+{Word}(?:\s+(?:{Joiner}|{Word})){{0,3}}",
        $@"{Abbrev}{Word}(?:\s+(?:{Joiner}|{Word})){{0,4}}\s+University",
    ];

    // Local institutions that appear as acronyms rather than a spelled-out name.
    private static readonly string[] KnownAcronyms = ["FINKI", "FEIT", "UACS", "UKIM"];

    private static readonly string[] FieldPatterns =
    [
        $@"(?:BSc|B\.Sc\.?|MSc|M\.Sc\.?|Bachelor(?:'s)?|Master(?:'s)?)\s*(?:of|in|degree in)?\s+({Word}(?:\s+(?:and|{Word})){{0,3}})",
        $@"(?:studying|student of|majoring in)\s+({Word}(?:\s+(?:and|{Word})){{0,3}})",
    ];

    public static string? Generate(string cvText, IReadOnlyList<string> detectedSkills)
    {
        if (string.IsNullOrWhiteSpace(cvText))
        {
            return null;
        }

        var institution = FindInstitution(cvText);
        var field = FindField(cvText);

        var sentences = new List<string>();

        var study = (field, institution) switch
        {
            ({ } f, { } i) => $"{f} student at {i}.",
            (null, { } i) => $"Student at {i}.",
            ({ } f, null) => $"{f} student.",
            _ => null
        };
        if (study is not null)
        {
            sentences.Add(study);
        }

        if (detectedSkills.Count > 0)
        {
            sentences.Add($"Works with {Join(detectedSkills.Take(MaxSkillsInBio).ToList())}.");
        }

        if (HasExperience(cvText))
        {
            sentences.Add("Has hands-on experience from internships or work.");
        }

        // One lone clause (e.g. only an experience signal) isn't a bio worth
        // putting in front of a student as a suggestion.
        return sentences.Count >= 2 ? string.Join(" ", sentences) : null;
    }

    private static string? FindInstitution(string text)
    {
        foreach (var pattern in InstitutionPatterns)
        {
            var match = Regex.Match(text, pattern);
            if (match.Success)
            {
                return Tidy(match.Value);
            }
        }

        return KnownAcronyms.FirstOrDefault(a =>
            Regex.IsMatch(text, $@"(?<![A-Za-z]){Regex.Escape(a)}(?![A-Za-z])", RegexOptions.IgnoreCase));
    }

    private static string? FindField(string text)
    {
        foreach (var pattern in FieldPatterns)
        {
            var match = Regex.Match(text, pattern);
            if (match.Success && match.Groups[1].Success)
            {
                var field = Tidy(match.Groups[1].Value);
                if (field.Length >= 3)
                {
                    return field;
                }
            }
        }

        return null;
    }

    private static bool HasExperience(string text) =>
        Regex.IsMatch(text, @"\b(intern|internship|worked at|employed|work experience|freelance)\b", RegexOptions.IgnoreCase);

    private static string Tidy(string value) =>
        Regex.Replace(value.Trim(), @"\s+", " ").TrimEnd(',', '.', ';', ':');

    private static string Join(IReadOnlyList<string> items) => items.Count switch
    {
        1 => items[0],
        2 => $"{items[0]} and {items[1]}",
        _ => $"{string.Join(", ", items.Take(items.Count - 1))} and {items[^1]}"
    };
}
