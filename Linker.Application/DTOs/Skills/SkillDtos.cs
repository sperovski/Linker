namespace Linker.Application.DTOs.Skills;

public record SkillResponse(int Id, string Name);

public record AssignSkillRequest(int SkillId);
