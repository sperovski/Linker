using System.ComponentModel.DataAnnotations;

namespace Linker.Application.Common.Validation;

/// <summary>
/// Model-binding front door for <see cref="PasswordPolicy"/>, so a weak password
/// is rejected as a 400 with a field error before any handler runs. The services
/// re-check the same policy — this attribute is the fast path, not the only gate.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class StrongPasswordAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        var failure = PasswordPolicy.Validate(value as string);
        return failure is null
            ? ValidationResult.Success
            : new ValidationResult(failure, [validationContext.MemberName ?? nameof(StrongPasswordAttribute)]);
    }
}
