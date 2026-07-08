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
    private static readonly string[] SkillNames =
    [
        "C#", "SQL", "Angular", "Python", "Docker", "Excel", "Power BI", "Git",
        "Java", "JavaScript", "TypeScript", "Figma", "CSS", "React", "Node.js", "Communication"
    ];

    public static async Task SeedAsync(LinkerDbContext db, IConfiguration configuration, ILogger logger, CancellationToken cancellationToken = default)
    {
        await SeedAdminAsync(db, configuration, logger, cancellationToken);

        if (!configuration.GetValue("Database:SeedDemoData", false))
        {
            return;
        }

        if (!await db.Skills.AnyAsync(cancellationToken))
        {
            db.Skills.AddRange(SkillNames.Select(name => new Skill { Name = name }));
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Seeded {Count} skills", SkillNames.Length);
        }

        if (!await db.Companies.AnyAsync(cancellationToken))
        {
            await SeedCompaniesAndInternshipsAsync(db, configuration, logger, cancellationToken);
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
}
