using Linker.Domain.Entities;

namespace Linker.Domain.Repositories;

// The profile sections are plain children of the Student aggregate: they are
// listed via IStudentRepository.GetWithProfileAsync and mutated by id, so the
// generic contract is all they need.
public interface IExperienceRepository : IRepository<Experience>;

public interface IEducationRepository : IRepository<Education>;

public interface IProjectRepository : IRepository<Project>;
