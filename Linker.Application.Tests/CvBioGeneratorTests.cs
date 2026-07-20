using Linker.Application.Common;

namespace Linker.Application.Tests;

public class CvBioGeneratorTests
{
    [Fact]
    public void Combines_FieldOfStudy_Institution_AndSkills()
    {
        var cv = "BSc Computer Science at Faculty of Computer Science and Engineering. Built things.";

        var bio = CvBioGenerator.Generate(cv, ["Angular", "C#"]);

        Assert.Equal(
            "Computer Science student at Faculty of Computer Science and Engineering. Works with Angular and C#.",
            bio);
    }

    [Fact]
    public void Recognises_A_NamedUniversity()
    {
        var cv = "Studying at Ss. Cyril and Methodius University. Skills: SQL";

        var bio = CvBioGenerator.Generate(cv, ["SQL"]);

        Assert.Contains("Ss. Cyril and Methodius University", bio);
    }

    [Fact]
    public void Recognises_A_LocalAcronym_WhenNoFullNameIsPresent()
    {
        var bio = CvBioGenerator.Generate("Student at FINKI, Skopje. Uses Angular.", ["Angular"]);

        Assert.Contains("FINKI", bio);
    }

    [Fact]
    public void Mentions_Experience_WhenTheCvShowsIt()
    {
        var cv = "BSc Economics at Skopje University. Worked at Acme as an intern.";

        var bio = CvBioGenerator.Generate(cv, []);

        Assert.Contains("hands-on experience", bio);
    }

    [Fact]
    public void Lists_AtMostSixSkills()
    {
        var skills = new[] { "A", "B", "C", "D", "E", "F", "G", "H" };

        var bio = CvBioGenerator.Generate("BSc Computer Science at Test University.", skills);

        Assert.Contains("F", bio);
        Assert.DoesNotContain("G", bio);
    }

    [Fact]
    public void Omits_TheStudyClause_WhenNoSchoolOrFieldIsFound()
    {
        var cv = "I have worked as an intern. My tools are listed below.";

        var bio = CvBioGenerator.Generate(cv, ["Angular", "C#"]);

        Assert.Equal("Works with Angular and C#. Has hands-on experience from internships or work.", bio);
    }

    [Fact]
    public void Returns_Null_WhenThereIsTooLittleToSay()
    {
        // A single clause isn't worth offering as a bio.
        Assert.Null(CvBioGenerator.Generate("Some unrelated prose about nothing much.", []));
        Assert.Null(CvBioGenerator.Generate("Worked as an intern.", []));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Returns_Null_ForEmptyText(string text)
    {
        Assert.Null(CvBioGenerator.Generate(text, ["Angular"]));
    }

    [Fact]
    public void Never_InventsFactsBeyondTheCv()
    {
        var bio = CvBioGenerator.Generate("BSc Physics at Test University. Uses Python.", ["Python"]);

        // Only what the text actually supports.
        Assert.DoesNotContain("hands-on experience", bio);
        Assert.Equal("Physics student at Test University. Works with Python.", bio);
    }
}
