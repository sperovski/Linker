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
    public static async Task SeedAsync(LinkerDbContext db, IConfiguration configuration, ILogger logger, CancellationToken cancellationToken = default)
    {
        await SeedAdminAsync(db, configuration, logger, cancellationToken);

        // The skill taxonomy is real catalogue data, not demo data: upsert it
        // unconditionally so every environment offers the full picker.
        await SeedSkillTaxonomyAsync(db, logger, cancellationToken);

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

        if (await db.Users.AnyAsync(u => u.Email == adminEmail, cancellationToken))
        {
            return;
        }

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
            ("stefan.perovski20@gmail.com", null, "Stefan", "Perovski", "UKIM - FINKI", 2026,
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

        var stefan = studentEntities["stefan.perovski20@gmail.com"];
        var marko = studentEntities["marko.ilievski@linker.demo"];
        var elena = studentEntities["elena.stojanova@linker.demo"];

        var now = DateTime.UtcNow;
        var applications = new (Student Student, Internship Internship, ApplicationStatus Status, int DaysAgo, string? CoverLetter)[]
        {
            (stefan, ByTitle("Frontend Intern"), ApplicationStatus.Accepted, 9,
                "I've shipped several Angular side projects and would love to bring that experience to a team building for real banking customers."),
            (stefan, ByTitle("Frontend Intern"), ApplicationStatus.Pending, 2, null),
            (stefan, ByTitle("UX/UI Design Intern"), ApplicationStatus.Rejected, 14,
                "I'm mostly a developer but have picked up Figma for a couple of class projects and would love to grow into design."),
            (marko, ByTitle("Backend Intern"), ApplicationStatus.Pending, 3,
                "I've built a few C#/SQL side projects and I'm excited about working on payments infrastructure."),
            (marko, ByTitle("DevOps Intern"), ApplicationStatus.Accepted, 6, null),
            (marko, ByTitle("IT Support Intern"), ApplicationStatus.Withdrawn, 20, null),
            (elena, ByTitle("UX/UI Design Intern"), ApplicationStatus.Pending, 1,
                "I've been running small usability tests for my coursework and would love real mentorship on product design."),
            (elena, ByTitle("Business Analysis Intern"), ApplicationStatus.Rejected, 11, null),
        };

        foreach (var a in applications)
        {
            // Frontend Intern title exists at two different companies; disambiguate the second Ana application.
            var internship = a.Internship;
            if (a.Student == stefan && a.Status == ApplicationStatus.Pending && internship.Title == "Frontend Intern")
            {
                internship = internships.First(i => i.Title == "Frontend Intern" && i.Company.Name == "Makedonski Telekom");
            }

            db.Applications.Add(new Linker.Domain.Entities.Application
            {
                Student = a.Student,
                Internship = internship,
                Status = a.Status,
                CoverLetter = a.CoverLetter,
                AppliedAtUtc = now.AddDays(-a.DaysAgo)
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
