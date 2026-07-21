namespace Linker.Domain;

/// <summary>
/// The 23 faculties of Ss. Cyril and Methodius University in Skopje (UKIM).
/// Authoritative server-side copy — a faculty chat channel may only be opened
/// for a name in this set, so a client can't create arbitrary rooms. Must stay
/// byte-for-byte in sync with the frontend list in
/// <c>frontend/src/app/shared/faculties.ts</c> (same names, same punctuation),
/// since the frontend passes these exact strings when opening a channel.
/// </summary>
public static class UkimFaculties
{
    public static readonly IReadOnlyList<string> All =
    [
        "Faculty of Agricultural Sciences and Food",
        "Faculty of Architecture",
        "Faculty of Civil Engineering",
        "Faculty of Computer Science and Engineering (FINKI)",
        "Faculty of Dentistry",
        "Faculty of Design and Technologies of Furniture and Interior",
        "Faculty of Dramatic Arts",
        "Faculty of Economics, Skopje",
        "Faculty of Electrical Engineering and Information Technologies (FEIT)",
        "Faculty of Fine Arts",
        "Faculty of Law “Iustinianus Primus”",
        "Faculty of Mechanical Engineering",
        "Faculty of Medicine",
        "Faculty of Music",
        "Faculty of Natural Sciences and Mathematics",
        "Faculty of Pedagogy “St. Kliment Ohridski”",
        "Faculty of Pharmacy",
        "Faculty of Philology “Blaže Koneski”",
        "Faculty of Philosophy",
        "Faculty of Physical Education, Sport and Health",
        "Faculty of Technology and Metallurgy",
        "Faculty of Veterinary Medicine",
        "Hans Em Faculty of Forest Sciences, Landscape Architecture and Environmental Engineering",
    ];

    private static readonly HashSet<string> Lookup = new(All, StringComparer.Ordinal);

    /// <summary>True when <paramref name="name"/> is exactly one of the known faculties.</summary>
    public static bool IsKnown(string? name) => name is not null && Lookup.Contains(name);
}
