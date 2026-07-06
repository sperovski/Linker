using Linker.Application.Common.Interfaces;
using Linker.Application.Services;
using Linker.Domain.Repositories;
using Linker.Infrastructure.Ai;
using Linker.Infrastructure.Auth;
using Linker.Infrastructure.Cv;
using Linker.Infrastructure.Persistence;
using Linker.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Linker.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is not configured.");

        services.AddDbContext<LinkerDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IStudentRepository, StudentRepository>();
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<IInternshipRepository, InternshipRepository>();
        services.AddScoped<IApplicationRepository, ApplicationRepository>();
        services.AddScoped<ISkillRepository, SkillRepository>();
        services.AddScoped<ISavedInternshipRepository, SavedInternshipRepository>();

        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<ICvTextExtractor, CvTextExtractor>();

        // Enable the AI-backed CV reviewer only when an API key is present;
        // otherwise the heuristic reviewer registered in AddApplication stands.
        if (!string.IsNullOrWhiteSpace(configuration["Anthropic:ApiKey"]))
        {
            services.AddHttpClient<ClaudeCvReviewService>();
            services.AddScoped<Application.Services.ICvReviewService>(
                sp => sp.GetRequiredService<ClaudeCvReviewService>());
        }

        return services;
    }
}
