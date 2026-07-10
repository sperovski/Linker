using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using ApplicationEntity = Linker.Domain.Entities.Application;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Persistence;

public class LinkerDbContext : DbContext, IUnitOfWork
{
    public LinkerDbContext(DbContextOptions<LinkerDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Internship> Internships => Set<Internship>();
    public DbSet<ApplicationEntity> Applications => Set<ApplicationEntity>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<StudentSkill> StudentSkills => Set<StudentSkill>();
    public DbSet<InternshipSkill> InternshipSkills => Set<InternshipSkill>();
    public DbSet<SavedInternship> SavedInternships => Set<SavedInternship>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserToken> UserTokens => Set<UserToken>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Experience> Experiences => Set<Experience>();
    public DbSet<Education> Educations => Set<Education>();
    public DbSet<Project> Projects => Set<Project>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LinkerDbContext).Assembly);
    }
}
