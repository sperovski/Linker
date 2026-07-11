namespace Linker.Domain.Enums;

public enum ApplicationStatus
{
    // Values are explicit and deliberately out of declaration order: Submitted
    // inherits Pending's stored value (0) and UnderReview takes the next free
    // one (4), so existing database rows keep meaning what they meant without
    // a data-remapping migration.
    Submitted = 0,
    UnderReview = 4,
    Accepted = 1,
    Rejected = 2,
    Withdrawn = 3
}
