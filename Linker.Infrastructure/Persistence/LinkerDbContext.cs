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

    /// <summary>
    /// Every new company and internship gets its own chat room, created here — the
    /// single choke point every creation path flows through (registration,
    /// internship posting, the seeder), so the rule can't be forgotten or
    /// duplicated. A parent's identity Id isn't assigned until it's saved, so this
    /// is a two-phase write: save the parents, then create their rooms. A
    /// transaction keeps the two phases atomic so a parent can never be committed
    /// without its room. (GetOrCreateRoom* in the chat service is the lazy fallback
    /// if a room is ever missing for any other reason.)
    /// </summary>
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

        var ownsTransaction = Database.CurrentTransaction is null;
        await using var transaction = ownsTransaction
            ? await Database.BeginTransactionAsync(cancellationToken)
            : null;

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

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return result;
    }
}
