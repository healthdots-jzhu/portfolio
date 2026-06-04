using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Portfolio.Api.Middleware;

/// <summary>
/// Mock authentication handler for local development.
/// Provides a test user identity without requiring Cognito JWT validation.
/// Allows testing authenticated endpoints locally without AWS access.
/// </summary>
public class MockAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public MockAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder) 
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        Logger.LogInformation("Using mock authentication handler for local development");

        // Create a test user identity with claims matching Cognito structure
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "local-test-user-id-guid"),
            new Claim("sub", "local-test-user-sub-value"),
            new Claim(ClaimTypes.Email, "test@local.dev"),
            new Claim("email_verified", "true"),
            new Claim("cognito:username", "testuser")
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        Logger.LogDebug("Mock authentication created for user: {User}", principal.FindFirst(ClaimTypes.Email)?.Value);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
