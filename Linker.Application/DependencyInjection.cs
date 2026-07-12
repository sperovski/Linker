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
        services.AddScoped<ISavedInternshipService, SavedInternshipService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IChatService, ChatService>();

        // Offline heuristic CV reviewer is the default. Infrastructure swaps in an
        // AI-backed reviewer when an Anthropic API key is configured.
        services.AddScoped<HeuristicCvReviewService>();
        services.AddScoped<ICvReviewService>(sp => sp.GetRequiredService<HeuristicCvReviewService>());

        return services;
    }
}
