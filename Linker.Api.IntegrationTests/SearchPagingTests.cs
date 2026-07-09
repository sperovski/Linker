using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Linker.Api.IntegrationTests;

/// <summary>
/// Paged search against real Postgres. The unit suite runs on SQLite and cannot
/// prove that ILike or the match-score ordering subquery translate to SQL — if
/// either silently fell back to client evaluation, paging would return wrong rows.
/// </summary>
public class SearchPagingTests : IClassFixture<LinkerApiFactory>
{
    private readonly LinkerApiFactory _factory;

    public SearchPagingTests(LinkerApiFactory factory) => _factory = factory;

    private record AuthBody(int userId, string email, string role, string token, string refreshToken);
    private record ListItem(int id, string title, string companyName, int? matchScore);
    private record Facet(string name, int count);
    private record SearchBody(List<ListItem> items, int total, int page, int pageSize, List<Facet> companies);

    private async Task<(HttpClient Client, string CompanyName)> CreateCompanyWithListingsAsync(int count, string titlePrefix)
    {
        var client = _factory.CreateClient();
        var companyName = $"Co-{Guid.NewGuid():N}"[..12];

        var register = await client.PostAsJsonAsync("/api/auth/register/company", new
        {
            email = $"co-{Guid.NewGuid():N}@test.local",
            password = "password123",
            name = companyName,
            description = (string?)null,
            website = (string?)null,
        });
        register.EnsureSuccessStatusCode();
        var body = await register.Content.ReadFromJsonAsync<AuthBody>();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.token);

        for (var i = 0; i < count; i++)
        {
            var created = await client.PostAsJsonAsync("/api/internships", new
            {
                title = $"{titlePrefix} {i}",
                description = "Integration test listing.",
                location = "Skopje",
                type = "Internship",
                startDate = (string?)null,
                endDate = (string?)null,
                applicationDeadline = (string?)null,
                skillIds = Array.Empty<int>(),
            });
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        }

        return (client, companyName);
    }

    [Fact]
    public async Task Search_PagesAreDisjoint_AndTotalCountsWholeResultSet()
    {
        var marker = $"Pager{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(5, marker);

        var anon = _factory.CreateClient();

        var first = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&page=1&pageSize=2");
        var second = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&page=2&pageSize=2");
        var third = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&page=3&pageSize=2");

        // ILike ran in SQL: only this test's listings came back.
        Assert.Equal(5, first!.total);
        Assert.Equal(2, first.items.Count);
        Assert.Equal(2, second!.items.Count);
        Assert.Single(third!.items);

        var ids = first.items.Concat(second.items).Concat(third.items).Select(i => i.id).ToList();
        Assert.Equal(5, ids.Distinct().Count());
    }

    [Fact]
    public async Task Search_OversizedPageSize_IsClamped()
    {
        var marker = $"Clamp{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(1, marker);

        var anon = _factory.CreateClient();
        var body = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}&pageSize=999");

        Assert.InRange(body!.pageSize, 1, 50);
        Assert.Equal(1, body.page);
    }

    [Fact]
    public async Task Search_AsStudent_TranslatesMatchScoreOrdering()
    {
        var marker = $"Score{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(3, marker);

        var student = _factory.CreateClient();
        var register = await student.PostAsJsonAsync("/api/auth/register/student", new
        {
            email = $"st-{Guid.NewGuid():N}@test.local",
            password = "password123",
            firstName = "Test",
            lastName = "Student",
        });
        var body = await register.Content.ReadFromJsonAsync<AuthBody>();
        student.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.token);

        // A student — even one with no skills — takes the scoring branch, so this
        // request fails outright if the ordering subquery can't be translated.
        var response = await student.GetAsync($"/api/internships?searchText={marker}&pageSize=2");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var page = await response.Content.ReadFromJsonAsync<SearchBody>();
        Assert.Equal(3, page!.total);
        Assert.Equal(2, page.items.Count);
    }

    [Fact]
    public async Task Search_CompanyFacet_CountsOpenRoles()
    {
        var marker = $"Facet{Guid.NewGuid():N}"[..14];
        var (_, companyName) = await CreateCompanyWithListingsAsync(3, marker);

        var anon = _factory.CreateClient();
        var body = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}");

        var facet = Assert.Single(body!.companies, c => c.name == companyName);
        Assert.Equal(3, facet.count);
    }

    [Fact]
    public async Task Applicants_ForNonOwningCompany_StillForbidden()
    {
        var marker = $"Owner{Guid.NewGuid():N}"[..14];
        await CreateCompanyWithListingsAsync(1, marker);

        var anon = _factory.CreateClient();
        var listing = await anon.GetFromJsonAsync<SearchBody>($"/api/internships?searchText={marker}");
        var internshipId = listing!.items[0].id;

        // A different company must not read the applicant list, paged or not.
        var (intruder, _) = await CreateCompanyWithListingsAsync(0, "unused");
        var response = await intruder.GetAsync($"/api/internships/{internshipId}/applications?page=1&pageSize=10");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
