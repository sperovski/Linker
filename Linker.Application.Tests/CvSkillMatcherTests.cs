using Linker.Application.Common;

namespace Linker.Application.Tests;

public class CvSkillMatcherTests
{
    private static readonly string[] Catalogue = ["C", "C#", "C++", "R", "Java", "JavaScript", "Go", "SQL"];

    [Fact]
    public void Does_Not_Match_Plain_C_Inside_CSharp()
    {
        // The bug this guards: '#' isn't a word character, so a plain word
        // boundary let "C" match inside "C#".
        var detected = CvSkillMatcher.DetectSkills("Backend work in C#.", Catalogue);

        Assert.Contains("C#", detected);
        Assert.DoesNotContain("C", detected);
    }

    [Fact]
    public void Does_Not_Match_Plain_C_Inside_CPlusPlus()
    {
        var detected = CvSkillMatcher.DetectSkills("Systems programming in C++.", Catalogue);

        Assert.Contains("C++", detected);
        Assert.DoesNotContain("C", detected);
    }

    [Fact]
    public void Does_Not_Match_R_Inside_RAndD()
    {
        Assert.DoesNotContain("R", CvSkillMatcher.DetectSkills("Worked in the R&D team.", Catalogue));
    }

    [Fact]
    public void Still_Matches_Standalone_C()
    {
        Assert.Contains("C", CvSkillMatcher.DetectSkills("Comfortable with C, Java and SQL.", Catalogue));
    }

    [Fact]
    public void Still_Matches_C_AtTheEndOfASentence()
    {
        // '.' stays a valid boundary on purpose.
        Assert.Contains("C", CvSkillMatcher.DetectSkills("My first language was C.", Catalogue));
    }

    [Fact]
    public void Does_Not_Match_Java_Inside_JavaScript()
    {
        var detected = CvSkillMatcher.DetectSkills("Frontend work in JavaScript.", Catalogue);

        Assert.Contains("JavaScript", detected);
        Assert.DoesNotContain("Java", detected);
    }

    [Fact]
    public void Matches_Case_Insensitively()
    {
        Assert.Contains("SQL", CvSkillMatcher.DetectSkills("wrote sql queries", Catalogue));
    }

    [Fact]
    public void Does_Not_Match_A_Skill_Inside_A_LongerWord()
    {
        // "Go" must not match "Google".
        Assert.DoesNotContain("Go", CvSkillMatcher.DetectSkills("Interned at Google.", Catalogue));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Empty_Text_Matches_Nothing(string text)
    {
        Assert.Empty(CvSkillMatcher.DetectSkills(text, Catalogue));
    }
}
