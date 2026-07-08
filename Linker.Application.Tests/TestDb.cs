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

    public LinkerDbContext Context { get; }

    public TestDb()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<LinkerDbContext>()
            .UseSqlite(_connection)
            .Options;

        Context = new LinkerDbContext(options);
        Context.Database.EnsureCreated();
    }

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
        Context.SaveChanges();
        return student;
    }

    public Company AddCompany(string email = "company@test.local", string name = "Test Co")
    {
        var company = new Company
        {
            Name = name,
            User = new User
            {
                Email = email,
                PasswordHash = "hash",
                Role = UserRole.Company,
                CreatedAtUtc = DateTime.UtcNow
            }
        };
        Context.Companies.Add(company);
        Context.SaveChanges();
        return company;
    }

    public Internship AddInternship(Company company, bool isActive = true, DateOnly? deadline = null)
    {
        var internship = new Internship
        {
            CompanyId = company.Id,
            Title = "Test Internship",
            Description = "A role for testing.",
            Type = InternshipType.Internship,
            IsActive = isActive,
            ApplicationDeadline = deadline,
            CreatedAtUtc = DateTime.UtcNow
        };
        Context.Internships.Add(internship);
        Context.SaveChanges();
        return internship;
    }

    public void Dispose()
    {
        Context.Dispose();
        _connection.Dispose();
    }
}
