using System.ComponentModel.DataAnnotations;

namespace Linker.Application.Common.Validation;

/// <summary>
/// Graduation-year rule for sign-up: current students graduate this year or
/// later. Null passes (the field is optional); a sane upper bound keeps typos out.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class CurrentYearOrLaterAttribute : ValidationAttribute
{
    private const int MaxYearsAhead = 10;

    public override bool IsValid(object? value)
    {
        if (value is null)
        {
            return true;
        }

        var currentYear = DateTime.UtcNow.Year;
        return value is int year && year >= currentYear && year <= currentYear + MaxYearsAhead;
    }

    public override string FormatErrorMessage(string name) =>
        $"{name} must be between {DateTime.UtcNow.Year} and {DateTime.UtcNow.Year + MaxYearsAhead}.";
}
