using Linker.Domain.Entities;
using Linker.Domain.Enums;
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
    public DbSet<ChatRoom> ChatRooms => Set<ChatRoom>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<ChatMessageReport> ChatMessageReports => Set<ChatMessageReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LinkerDbContext).Assembly);
    }

    
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var newCompanies = ChangeTracker.Entries<Company>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity)
            .ToList();
        var newInternships = ChangeTracker.Entries<Internship>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity)
            .ToList();

        if (newCompanies.Count == 0 && newInternships.Count == 0)
        {
            return await base.SaveChangesAsync(cancellationToken);
        }

        async Task<int> SaveWithRoomsAsync()
        {
            var result = await base.SaveChangesAsync(cancellationToken);

            foreach (var company in newCompanies)
            {
                ChatRooms.Add(ChatRoom.ForCompany(company.Id, company.Name, DateTime.UtcNow));
            }
            foreach (var internship in newInternships)
            {
                ChatRooms.Add(ChatRoom.ForInternship(internship.Id, internship.Title, DateTime.UtcNow));
            }
            await base.SaveChangesAsync(cancellationToken);

            return result;
        }

        if (Database.CurrentTransaction is not null)
        {
            // An upstream owner already holds the transaction (and, with a
            // retrying strategy, already runs inside it) — just do the writes.
            return await SaveWithRoomsAsync();
        }

        // BeginTransaction must run through the execution strategy: with
        // EnableRetryOnFailure, user-initiated transactions outside
        // ExecuteAsync throw InvalidOperationException.
        var strategy = Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await Database.BeginTransactionAsync(cancellationToken);
            var result = await SaveWithRoomsAsync();
            await transaction.CommitAsync(cancellationToken);
            return result;
        });
    }
}
