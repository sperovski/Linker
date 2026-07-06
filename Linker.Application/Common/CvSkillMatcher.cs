using System.Text.RegularExpressions;

namespace Linker.Application.Common;

/// <summary>
/// Detects which of a known set of skill names appear in free-text CV content.
/// Shared by the heuristic and AI CV reviewers so matched/missing skill lists are
/// computed deterministically regardless of the reviewer backend.
/// </summary>
public static class CvSkillMatcher
{
    public static bool Mentions(string text, string skillName)
    {
        if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(skillName))
        {
            return false;
        }

        // Skills containing non-alphanumeric characters (C#, Power BI) can't rely on
        // \b word boundaries, so fall back to a plain case-insensitive contains.
        var alphanumericOnly = skillName.All(c => char.IsLetterOrDigit(c) || c == ' ');
        if (!alphanumericOnly)
        {
            return text.Contains(skillName, StringComparison.OrdinalIgnoreCase);
        }

        var pattern = $@"(?<![A-Za-z0-9]){Regex.Escape(skillName)}(?![A-Za-z0-9])";
        return Regex.IsMatch(text, pattern, RegexOptions.IgnoreCase);
    }

    public static IReadOnlyList<string> DetectSkills(string text, IEnumerable<string> knownSkills)
    {
        return knownSkills.Where(s => Mentions(text, s)).Distinct().ToList();
    }
}
