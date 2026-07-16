using System.Net.Http.Json;

namespace Linker.Api.IntegrationTests;

internal static class TestData
{
    private record SkillBody(int id, string name, string category);

    /// <summary>
    /// Creating an internship requires at least one skill. The skill taxonomy
    /// is seeded on startup in every environment, so any id from the public
    /// /api/skills list is valid.
    /// </summary>
    public static async Task<int> AnySkillIdAsync(HttpClient client)
    {
        var skills = await client.GetFromJsonAsync<List<SkillBody>>("/api/skills");
        return skills![0].id;
    }
}
