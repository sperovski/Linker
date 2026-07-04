using System.ComponentModel.DataAnnotations;

namespace Linker.Application.DTOs.Skills;

public record SkillResponse(int Id, string Name);

public record AssignSkillRequest(
    [Range(1, int.MaxValue)] int SkillId);
