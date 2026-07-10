using Linker.Domain.Entities;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Persistence;

namespace Linker.Infrastructure.Repositories;

public class ExperienceRepository : Repository<Experience>, IExperienceRepository
{
    public ExperienceRepository(LinkerDbContext context) : base(context)
    {
    }
}

public class EducationRepository : Repository<Education>, IEducationRepository
{
    public EducationRepository(LinkerDbContext context) : base(context)
    {
    }
}

public class ProjectRepository : Repository<Project>, IProjectRepository
{
    public ProjectRepository(LinkerDbContext context) : base(context)
    {
    }
}
