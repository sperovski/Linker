namespace Linker.Domain.Enums;

public enum ChatRoomType
{
    /// <summary>The single open "FINKI Students" room, tied to no company or internship.</summary>
    General = 0,
    /// <summary>One per company; CompanyId is set, InternshipId is null.</summary>
    Company = 1,
    /// <summary>One per internship posting; InternshipId is set, CompanyId is null.</summary>
    Internship = 2,
    /// <summary>One per UKIM faculty; no FK, the faculty name is the Title. Open to all students.</summary>
    Faculty = 3,
}
