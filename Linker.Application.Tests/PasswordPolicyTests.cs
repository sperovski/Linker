using Linker.Application.Common.Validation;

namespace Linker.Application.Tests;

/// <summary>
/// The policy is the single gate every password entry point shares, so these
/// tests pin the rule itself rather than any one caller's use of it.
/// </summary>
public class PasswordPolicyTests
{
    [Theory]
    [InlineData("Fixture-Pass-1")]      // lower + upper + digit + symbol
    [InlineData("correct horse9B")]     // long passphrase, three classes
    [InlineData("Tr0ubad0urXY")]        // no symbol, but three other classes
    public void Accepts_APasswordMeetingEveryRule(string password)
    {
        Assert.Null(PasswordPolicy.Validate(password));
    }

    [Fact]
    public void Rejects_APasswordShorterThanTheMinimum()
    {
        Assert.Contains("at least", PasswordPolicy.Validate("Ab1-xyz"));
    }

    [Fact]
    public void Rejects_APasswordSpanningTooFewCharacterClasses()
    {
        // Lowercase only: long enough and not a sequence, but a single class.
        Assert.Contains("three of", PasswordPolicy.Validate("banana bread flour"));
    }

    [Fact]
    public void Rejects_ACommonPassword()
    {
        Assert.Contains("too common", PasswordPolicy.Validate("Password123"));
    }

    [Theory]
    [InlineData("abcdefghijkl")]   // one ascending run
    [InlineData("9876543210")]     // one descending run
    [InlineData("aaaaaaaaaaaa")]   // one repeated character
    public void Rejects_APredictableRun(string password)
    {
        Assert.Contains("predictable", PasswordPolicy.Validate(password));
    }

    [Fact]
    public void Rejects_APasswordContainingTheAccountsOwnEmail()
    {
        // Guessable by anyone who knows the address — which, for a login, is everyone.
        Assert.Contains("email address", PasswordPolicy.Validate("Marko.Ilievski-42", "marko.ilievski@example.com"));
    }

    [Fact]
    public void Ignores_TheEmailRule_WhenNoEmailIsSupplied()
    {
        Assert.Null(PasswordPolicy.Validate("Marko.Ilievski-42"));
    }

    [Fact]
    public void Rejects_AnEmptyPassword()
    {
        Assert.NotNull(PasswordPolicy.Validate(""));
        Assert.NotNull(PasswordPolicy.Validate(null));
    }

    [Fact]
    public void Rejects_APasswordOverTheMaximum()
    {
        Assert.Contains("cannot exceed", PasswordPolicy.Validate("Aa1-" + new string('x', PasswordPolicy.MaxLength)));
    }
}
