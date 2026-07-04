using Linker.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Linker.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IStudentService, StudentService>();
        services.AddScoped<ICompanyService, CompanyService>();
        services.AddScoped<IInternshipService, InternshipService>();
        services.AddScoped<IApplicationService, ApplicationService>();
        services.AddScoped<ISkillService, SkillService>();

        return services;
    }
}
