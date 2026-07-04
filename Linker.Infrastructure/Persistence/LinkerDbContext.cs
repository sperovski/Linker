using Linker.Domain.Entities;
using ApplicationEntity = Linker.Domain.Entities.Application;
using Microsoft.EntityFrameworkCore;

namespace Linker.Infrastructure.Persistence;

public class LinkerDbContext : DbContext
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LinkerDbContext).Assembly);
    }
}
