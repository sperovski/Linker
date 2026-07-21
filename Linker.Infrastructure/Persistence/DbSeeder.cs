using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Linker.Infrastructure.Persistence;

/// <summary>
/// Idempotent startup seeding: each block only runs when its table is empty,
/// so re-running against an existing database is a no-op. Demo companies and
/// internships are for dev/demo stacks; the admin account seeds anywhere an
/// admin password is configured.
/// </summary>
public static class DbSeeder
{
    /// <summary>
    /// The one seeded student that belongs to a real person; its password is
    /// injected via config rather than committed (see SyncPrimaryStudentPasswordAsync).
    /// </summary>
    private const string PrimaryStudentEmail = "stefan.perovski20@gmail.com";

    public static async Task SeedAsync(LinkerDbContext db, IConfiguration configuration, ILogger logger, CancellationToken cancellationToken = default)
    {
        await SeedAdminAsync(db, configuration, logger, cancellationToken);

        // The skill taxonomy is real catalogue data, not demo data: upsert it
        // unconditionally so every environment offers the full picker.
        await SeedSkillTaxonomyAsync(db, logger, cancellationToken);

        // The General "All Students" room is a singleton the whole app shares,
        // so ensure it exists in every environment (not just demo stacks).
        await EnsureGeneralChatRoomAsync(db, logger, cancellationToken);

        if (!configuration.GetValue("Database:SeedDemoData", false))
        {
            return;
        }

        if (!await db.Companies.AnyAsync(cancellationToken))
        {
            await SeedCompaniesAndInternshipsAsync(db, configuration, logger, cancellationToken);
        }

        if (!await db.Students.AnyAsync(cancellationToken))
        {
            await SeedStudentsAndActivityAsync(db, configuration, logger, cancellationToken);
        }

        await SyncPrimaryStudentPasswordAsync(db, configuration, logger, cancellationToken);
    }

    /// <summary>
    /// Stefan's demo account is a real person's login, so its password must not
    /// be committed (see the note in SeedStudentsAndActivityAsync). It comes from
    /// Seed:StefanPassword instead — e.g. a gitignored .env next to
    /// docker-compose.yml — and is re-synced on every demo-stack start, so it
    /// survives volume wipes and re-seeds without manual DB updates.
    /// </summary>
    private static async Task SyncPrimaryStudentPasswordAsync(LinkerDbContext db, IConfiguration configuration, ILogger logger, CancellationToken cancellationToken)
    {
        var password = configuration["Seed:StefanPassword"];
        if (string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == PrimaryStudentEmail, cancellationToken);
        if (user is null || PasswordMatches(password, user.PasswordHash))
        {
            return;
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Re-synced seeded password for {Email} from Seed:StefanPassword", PrimaryStudentEmail);
    }

    private const string GeneralRoomTitle = "All Students";

    /// <summary>
    /// Ensures the single General chat room exists and carries the current
    /// title. It used to be "FINKI Students"; now that each faculty (FINKI
    /// included) has its own channel, that name is confusing, so an existing
    /// room is renamed in place. The Title setter is private by design, so the
    /// correction goes through EF's property API rather than a domain mutator.
    /// </summary>
    private static async Task EnsureGeneralChatRoomAsync(LinkerDbContext db, ILogger logger, CancellationToken cancellationToken)
    {
        var general = await db.ChatRooms.FirstOrDefaultAsync(r => r.Type == ChatRoomType.General, cancellationToken);
        if (general is not null)
        {
            if (general.Title != GeneralRoomTitle)
            {
                db.Entry(general).Property(r => r.Title).CurrentValue = GeneralRoomTitle;
                await db.SaveChangesAsync(cancellationToken);
                logger.LogInformation("Renamed the General chat room to '{Title}'", GeneralRoomTitle);
            }
            return;
        }

        db.ChatRooms.Add(ChatRoom.CreateGeneral(GeneralRoomTitle, DateTime.UtcNow));
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded the General chat room");
    }

    /// <summary>
    /// Upserts <see cref="SkillTaxonomy"/> by name: missing skills are inserted,
    /// existing ones are re-categorised if the taxonomy moved them. Never deletes,
    /// so skills students already reference stay valid.
    /// </summary>
    private static async Task SeedSkillTaxonomyAsync(LinkerDbContext db, ILogger logger, CancellationToken cancellationToken)
    {
        var existing = await db.Skills.ToDictionaryAsync(s => s.Name, cancellationToken);
        var added = 0;
        var recategorised = 0;

        foreach (var (category, names) in SkillTaxonomy.Categories)
        {
            foreach (var name in names)
            {
                if (existing.TryGetValue(name, out var skill))
                {
                    if (skill.Category != category)
                    {
                        skill.Category = category;
                        recategorised++;
                    }
                }
                else
                {
                    db.Skills.Add(new Skill { Name = name, Category = category });
                    added++;
                }
            }
        }

        if (added > 0 || recategorised > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Skill taxonomy synced: {Added} added, {Recategorised} re-categorised", added, recategorised);
        }
    }

    private static async Task SeedAdminAsync(LinkerDbContext db, IConfiguration configuration, ILogger logger, CancellationToken cancellationToken)
    {
        var adminEmail = configuration["Seed:AdminEmail"];
        var adminPassword = configuration["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
        {
            return;
        }

        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == adminEmail, cancellationToken);
        if (existing is null)
        {
            db.Users.Add(new User
            {
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                Role = UserRole.Admin,
                CreatedAtUtc = DateTime.UtcNow,
                EmailVerified = true,
                IsActive = true
            });
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Seeded admin account {Email}", adminEmail);
            return;
        }

        // Rotating Seed:AdminPassword used to be silently ignored once the row
        // existed. Sync the hash on demo stacks only, so a production admin who
        // changed their password through the app is never reverted by a restart.
        if (configuration.GetValue("Database:SeedDemoData", false)
            && !PasswordMatches(adminPassword, existing.PasswordHash))
        {
            existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Re-synced seeded admin password for {Email} from Seed:AdminPassword", adminEmail);
        }
    }

    /// <summary>
    /// A Verify that never throws: a malformed stored hash (hand-edited row,
    /// unhashed import) counts as "doesn't match", so the sync paths above
    /// simply re-hash it instead of crashing startup seeding.
    /// </summary>
    private static bool PasswordMatches(string password, string storedHash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, storedHash);
        }
        catch (Exception e) when (e is BCrypt.Net.SaltParseException or ArgumentException)
        {
            return false;
        }
    }

    private static async Task SeedCompaniesAndInternshipsAsync(LinkerDbContext db, IConfiguration configuration, ILogger logger, CancellationToken cancellationToken)
    {
        var demoPassword = configuration["Seed:DemoPassword"] ?? "Demo123!linker";
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(demoPassword);
        var skills = await db.Skills.ToDictionaryAsync(s => s.Name, cancellationToken);

        var companies = new (string Name, string Description, string Website)[]
        {
            ("Netcetera", "Software engineering for finance, transport and health.", "https://www.netcetera.com"),
            ("Endava", "Technology services: from ideation to production.", "https://www.endava.com"),
            ("Seavus", "IT consulting and product development.", "https://www.seavus.com"),
            ("NLB Banka", "One of the largest banking groups in the region.", "https://www.nlb.mk"),
            ("Stopanska Banka", "Full-service bank in North Macedonia.", "https://www.stb.com.mk"),
            ("Komercijalna Banka", "Leading independent bank in Skopje.", "https://www.kb.com.mk"),
            ("Alkaloid", "Pharmaceuticals, cosmetics and chemicals.", "https://www.alkaloid.com.mk"),
            ("A1 Macedonia", "Telecommunications operator, part of A1 Group.", "https://www.a1.mk"),
            ("Makedonski Telekom", "National telecom, part of Deutsche Telekom.", "https://www.telekom.mk"),
            ("Makstil", "Steel plate production, part of Duferco Group.", "https://www.makstil.com"),
        };

        var companyEntities = companies.Select(c => new Company
        {
            Name = c.Name,
            Description = c.Description,
            Website = c.Website,
            User = new User
            {
                Email = $"careers@{c.Name.ToLowerInvariant().Replace(" ", "")}.demo",
                PasswordHash = passwordHash,
                Role = UserRole.Company,
                CreatedAtUtc = DateTime.UtcNow,
                EmailVerified = true,
                IsActive = true
            }
        }).ToDictionary(c => c.Name);

        db.Companies.AddRange(companyEntities.Values);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var listings = new (string Company, string Title, string Description, string? Location, InternshipType Type, string[] Skills, int DeadlineDays)[]
        {
            ("Netcetera", "Frontend Intern", "Work on Angular apps used by banks across Europe. You'll ship real features with a mentor reviewing every PR.", "Skopje", InternshipType.Internship, ["Angular", "TypeScript", "CSS"], 30),
            ("Netcetera", "Backend Intern", "Join a payments team building .NET services with high reliability requirements.", "Skopje", InternshipType.Internship, ["C#", "SQL", "Git"], 45),
            ("Endava", "Software Engineering Intern", "Rotate across two delivery teams and learn how enterprise software actually ships.", "Skopje", InternshipType.Internship, ["Java", "SQL", "Git"], 40),
            ("Endava", "DevOps Intern", "Learn CI/CD, containers and cloud infrastructure hands-on.", "Remote", InternshipType.PartTime, ["Docker", "Git", "Python"], 35),
            ("Seavus", "UX/UI Design Intern", "Shadow a senior designer, run usability tests and design real product screens.", "Skopje", InternshipType.PartTime, ["Figma", "CSS", "Communication"], 25),
            ("NLB Banka", "Data Analysis Intern", "Build reports and dashboards the business actually uses every morning.", "Skopje", InternshipType.Internship, ["Excel", "Power BI", "SQL"], 30),
            ("Stopanska Banka", "Business Analysis Intern", "Work between IT and the business on digital banking initiatives.", "Skopje", InternshipType.FullTime, ["Excel", "Communication", "SQL"], 50),
            ("Komercijalna Banka", "IT Support Intern", "First-line support and small automation projects across the bank.", "Skopje", InternshipType.PartTime, ["Communication", "Excel"], 28),
            ("Alkaloid", "Quality Data Intern", "Digitalize quality-control data flows in a pharma production environment.", "Skopje", InternshipType.Internship, ["Excel", "Python"], 32),
            ("A1 Macedonia", "Network Operations Intern", "Learn how a national mobile network is monitored and maintained.", "Skopje", InternshipType.Internship, ["Python", "Communication"], 38),
            ("Makedonski Telekom", "Frontend Intern", "React work on customer self-service portals.", "Remote", InternshipType.PartTime, ["React", "JavaScript", "CSS"], 42),
            ("Makstil", "Process Engineering Intern", "Data-driven improvements on the production floor.", "Skopje", InternshipType.FullTime, ["Excel", "Python"], 36),
        };

        foreach (var l in listings)
        {
            var internship = new Internship
            {
                Company = companyEntities[l.Company],
                Title = l.Title,
                Description = l.Description,
                Location = l.Location,
                Type = l.Type,
                StartDate = today.AddDays(l.DeadlineDays + 20),
                EndDate = today.AddDays(l.DeadlineDays + 200),
                ApplicationDeadline = today.AddDays(l.DeadlineDays),
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            };
            foreach (var skillName in l.Skills)
            {
                internship.RequiredSkills.Add(new InternshipSkill { Skill = skills[skillName] });
            }
            db.Internships.Add(internship);
        }

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded {Companies} demo companies and {Listings} internships",
            companies.Length, listings.Length);
    }

    private static async Task SeedStudentsAndActivityAsync(LinkerDbContext db, IConfiguration configuration, ILogger logger, CancellationToken cancellationToken)
    {
        var demoPassword = configuration["Seed:DemoPassword"] ?? "Demo123!linker";
        var skills = await db.Skills.ToDictionaryAsync(s => s.Name, cancellationToken);
        var internships = await db.Internships.Include(i => i.Company).ToListAsync(cancellationToken);
        Internship ByTitle(string title) => internships.First(i => i.Title == title);

        // A null Password falls back to the shared demo password (Seed:DemoPassword,
        // default Demo123!linker). Never hardcode a real personal password here — this
        // file is committed and the demo stack is public.
        var students = new (string Email, string? Password, string FirstName, string LastName, string University, int GradYear, string Bio, string[] Skills)[]
        {
            (PrimaryStudentEmail, null, "Stefan", "Perovski", "UKIM - FINKI", 2026,
                "Third-year CS student who loves building clean UIs and learning backend fundamentals. Looking for a frontend or full-stack internship.",
                ["Angular", "TypeScript", "CSS", "JavaScript", "Git"]),
            ("marko.ilievski@linker.demo", null, "Marko", "Ilievski", "UKIM - FINKI", 2025,
                "Backend-leaning student with coursework in databases and distributed systems. Comfortable with C# and SQL.",
                ["C#", "SQL", "Docker", "Git"]),
            ("elena.stojanova@linker.demo", null, "Elena", "Stojanova", "American University of Europe - FON", 2027,
                "Design-minded student exploring UX research and product design through coursework and freelance projects.",
                ["Figma", "CSS", "Communication"]),
        };

        var studentEntities = new Dictionary<string, Student>();
        foreach (var s in students)
        {
            var student = new Student
            {
                FirstName = s.FirstName,
                LastName = s.LastName,
                University = s.University,
                GraduationYear = s.GradYear,
                Bio = s.Bio,
                User = new User
                {
                    Email = s.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(s.Password ?? demoPassword),
                    Role = UserRole.Student,
                    CreatedAtUtc = DateTime.UtcNow,
                    EmailVerified = true,
                    IsActive = true
                }
            };
            foreach (var skillName in s.Skills)
            {
                student.Skills.Add(new StudentSkill { Skill = skills[skillName] });
            }
            db.Students.Add(student);
            studentEntities[s.Email] = student;
        }

        await db.SaveChangesAsync(cancellationToken);

        var stefan = studentEntities[PrimaryStudentEmail];
        var marko = studentEntities["marko.ilievski@linker.demo"];
        var elena = studentEntities["elena.stojanova@linker.demo"];

        var now = DateTime.UtcNow;
        var applications = new (Student Student, Internship Internship, ApplicationStatus Status, int DaysAgo, string? CoverNote)[]
        {
            (stefan, ByTitle("Frontend Intern"), ApplicationStatus.Accepted, 9,
                "I've shipped several Angular side projects and would love to bring that experience to a team building for real banking customers."),
            (stefan, ByTitle("Frontend Intern"), ApplicationStatus.Submitted, 2, null),
            (stefan, ByTitle("UX/UI Design Intern"), ApplicationStatus.Rejected, 14,
                "I'm mostly a developer but have picked up Figma for a couple of class projects and would love to grow into design."),
            (marko, ByTitle("Backend Intern"), ApplicationStatus.Submitted, 3,
                "I've built a few C#/SQL side projects and I'm excited about working on payments infrastructure."),
            (marko, ByTitle("DevOps Intern"), ApplicationStatus.Accepted, 6, null),
            (marko, ByTitle("IT Support Intern"), ApplicationStatus.Withdrawn, 20, null),
            (elena, ByTitle("UX/UI Design Intern"), ApplicationStatus.Submitted, 1,
                "I've been running small usability tests for my coursework and would love real mentorship on product design."),
            (elena, ByTitle("Business Analysis Intern"), ApplicationStatus.Rejected, 11, null),
        };

        foreach (var a in applications)
        {
            // Frontend Intern title exists at two different companies; disambiguate the second Ana application.
            var internship = a.Internship;
            if (a.Student == stefan && a.Status == ApplicationStatus.Submitted && internship.Title == "Frontend Intern")
            {
                internship = internships.First(i => i.Title == "Frontend Intern" && i.Company.Name == "Makedonski Telekom");
            }

            db.Applications.Add(new Linker.Domain.Entities.Application
            {
                Student = a.Student,
                Internship = internship,
                Status = a.Status,
                CoverNote = a.CoverNote,
                CreatedAt = now.AddDays(-a.DaysAgo),
                UpdatedAt = now.AddDays(-a.DaysAgo)
            });
        }

        var saved = new (Student Student, string Title, string Company)[]
        {
            (stefan, "Software Engineering Intern", "Endava"),
            (stefan, "Backend Intern", "Netcetera"),
            (marko, "Frontend Intern", "Netcetera"),
            (elena, "Data Analysis Intern", "NLB Banka"),
        };

        foreach (var s in saved)
        {
            var internship = internships.First(i => i.Title == s.Title && i.Company.Name == s.Company);
            db.SavedInternships.Add(new SavedInternship
            {
                Student = s.Student,
                Internship = internship,
                SavedAtUtc = now.AddDays(-Random.Shared.Next(1, 15))
            });
        }

        db.Notifications.Add(new Notification
        {
            User = stefan.User,
            Message = "Great news! Netcetera accepted your application for Frontend Intern.",
            Link = "/applications",
            CreatedAtUtc = now.AddDays(-9)
        });
        db.Notifications.Add(new Notification
        {
            User = stefan.User,
            Message = "Makedonski Telekom is reviewing your application for Frontend Intern.",
            Link = "/applications",
            CreatedAtUtc = now.AddDays(-2)
        });
        db.Notifications.Add(new Notification
        {
            User = marko.User,
            Message = "Endava accepted your application for DevOps Intern.",
            Link = "/applications",
            CreatedAtUtc = now.AddDays(-6)
        });
        db.Notifications.Add(new Notification
        {
            User = elena.User,
            Message = "New internship matching your skills: UX/UI Design Intern at Seavus.",
            Link = "/internships",
            CreatedAtUtc = now.AddDays(-1)
        });

        var netcetera = ByTitle("Frontend Intern").Company;
        var endava = ByTitle("DevOps Intern").Company;
        db.Notifications.Add(new Notification
        {
            User = netcetera.User,
            Message = "Stefan Perovski applied to Frontend Intern.",
            Link = "/company/listings",
            CreatedAtUtc = now.AddDays(-9)
        });
        db.Notifications.Add(new Notification
        {
            User = endava.User,
            Message = "Marko Ilievski applied to DevOps Intern.",
            Link = "/company/listings",
            CreatedAtUtc = now.AddDays(-6)
        });

        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded {Count} demo students with applications, saved internships and notifications", students.Length);
    }
}
