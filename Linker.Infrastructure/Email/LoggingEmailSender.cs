using Linker.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace Linker.Infrastructure.Email;

/// <summary>
/// Default email sender for dev/demo: logs the message instead of sending it, so
/// verification and reset links are visible in the console without an SMTP setup.
/// A real <see cref="SmtpEmailSender"/> replaces it when SMTP is configured.
/// </summary>
public class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "[DEV EMAIL] To: {To} | Subject: {Subject}\n{Body}",
            toEmail, subject, htmlBody);
        return Task.CompletedTask;
    }
}
