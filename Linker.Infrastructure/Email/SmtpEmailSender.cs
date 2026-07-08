using System.Net;
using System.Net.Mail;
using Linker.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Linker.Infrastructure.Email;

/// <summary>
/// SMTP-backed sender, registered only when <c>Smtp:Host</c> is configured.
/// Works with any SMTP relay (SendGrid, Mailgun, a company relay, etc.).
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly ILogger<SmtpEmailSender> _logger;
    private readonly string _host;
    private readonly int _port;
    private readonly string? _user;
    private readonly string? _password;
    private readonly bool _useSsl;
    private readonly string _fromAddress;
    private readonly string _fromName;

    public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
    {
        _logger = logger;
        _host = configuration["Smtp:Host"]!;
        _port = int.TryParse(configuration["Smtp:Port"], out var p) ? p : 587;
        _user = configuration["Smtp:Username"];
        _password = configuration["Smtp:Password"];
        _useSsl = !bool.TryParse(configuration["Smtp:UseSsl"], out var ssl) || ssl;
        _fromAddress = configuration["Smtp:FromAddress"] ?? "no-reply@linker.local";
        _fromName = configuration["Smtp:FromName"] ?? "Linker";
    }

    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        using var message = new MailMessage
        {
            From = new MailAddress(_fromAddress, _fromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(toEmail);

        using var client = new SmtpClient(_host, _port) { EnableSsl = _useSsl };
        if (!string.IsNullOrWhiteSpace(_user))
        {
            client.Credentials = new NetworkCredential(_user, _password);
        }

        try
        {
            await client.SendMailAsync(message, cancellationToken);
        }
        catch (Exception ex)
        {
            // Never let a transactional email failure break the user-facing action.
            _logger.LogError(ex, "Failed to send email to {To}", toEmail);
        }
    }
}
