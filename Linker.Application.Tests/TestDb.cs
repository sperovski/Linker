using Linker.Domain.Entities;
using Linker.Domain.Enums;
using Linker.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Linker.Application.Tests;

/// <summary>
/// Real LinkerDbContext on an in-memory SQLite database, so services run
/// against the actual EF model (constraints, unique indexes) without Postgres.
/// </summary>
public sealed class TestDb : IDisposable
{
    private readonly SqliteConnection _connection;

    private readonly DbContextOptions<LinkerDbContext> _options;

    public LinkerDbContext Context { get; }

    public TestDb()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _options = new DbContextOptionsBuilder<LinkerDbContext>()
            .UseSqlite(_connection)
            .Options;

        Context = new LinkerDbContext(_options);
        Context.Database.EnsureCreated();
    }

    /// <summary>
    /// A fresh LinkerDbContext against the same live database, mirroring the
    /// scoped-per-request DbContext a real HTTP request gets in production.
    /// Use this (not the shared <see cref="Context"/>) when a test simulates
    /// more than one "request" and needs each to see the others' committed
    /// writes without any stale change-tracker state carried over — a single
    /// shared context wouldn't pick up rows changed via bulk
    /// ExecuteUpdateAsync calls (e.g. token-family revocation) that it already
    /// has a stale tracked copy of, whereas a fresh scope always reads current.
    /// </summary>
    public LinkerDbContext NewContext() => new(_options);

    public Student AddStudent(string email = "student@test.local")
    {
        var student = new Student
        {
            FirstName = "Test",
            LastName = "Student",
            User = new User
            {
                Email = email,
                PasswordHash = "hash",
                Role = UserRole.Student,
                CreatedAtUtc = DateTime.UtcNow
            }
        };
        Context.Students.Add(student);
        Save();
        return student;
    }

    public Company AddCompany(string email = "company@test.local", string name = "Test Co", bool isVerified = false)
    {
        var company = new Company
        {
            Name = name,
            IsVerified = isVerified,
            VerifiedAtUtc = isVerified ? DateTime.UtcNow : null,
            User = new User
            {
                Email = email,
                PasswordHash = "hash",
                Role = UserRole.Company,
                CreatedAtUtc = DateTime.UtcNow
            }
        };
        Context.Companies.Add(company);
        Save();
        return company;
    }

    public Internship AddInternship(
        Company company,
        bool isActive = true,
        DateOnly? deadline = null,
        string title = "Test Internship",
        DateTime? createdAtUtc = null,
        params int[] requiredSkillIds)
    {
        var internship = new Internship
        {
            CompanyId = company.Id,
            Title = title,
            Description = "A role for testing.",
            Type = InternshipType.Internship,
            IsActive = isActive,
            ApplicationDeadline = deadline,
            CreatedAtUtc = createdAtUtc ?? DateTime.UtcNow,
            RequiredSkills = requiredSkillIds.Select(id => new InternshipSkill { SkillId = id }).ToList()
        };
        Context.Internships.Add(internship);
        Save();
        return internship;
    }

    public Skill AddSkill(string name)
    {
        var skill = new Skill { Name = name };
        Context.Skills.Add(skill);
        Save();
        return skill;
    }

    public void GiveStudentSkills(Student student, params int[] skillIds)
    {
        foreach (var id in skillIds)
        {
            Context.Set<StudentSkill>().Add(new StudentSkill { StudentId = student.Id, SkillId = id });
        }
        Save();
    }

    /// <summary>
    /// Seeding goes through SaveChangesAsync like the app does, so entities with
    /// invariants enforced there (chat rooms for companies and internships) are
    /// set up exactly as they would be in production.
    /// </summary>
    public void Save() => Context.SaveChangesAsync().GetAwaiter().GetResult();

    public void Dispose()
    {
        Context.Dispose();
        _connection.Dispose();
    }
}
