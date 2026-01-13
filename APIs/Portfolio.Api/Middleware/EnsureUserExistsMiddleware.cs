using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Models;

namespace Portfolio.Api.Middleware;

/// <summary>
/// Middleware that ensures authenticated users exist in the local Users table (JIT provisioning).
/// Extracts Cognito 'sub' claim, creates user record if missing, and adds 'userId' claim for downstream use.
/// </summary>
public class EnsureUserExistsMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<EnsureUserExistsMiddleware> _logger;

    public EnsureUserExistsMiddleware(RequestDelegate next, ILogger<EnsureUserExistsMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
    {
        // Only process authenticated requests
        if (context.User.Identity?.IsAuthenticated == true)
        {
            // Debug: Log all claims to see what's actually present
            _logger.LogDebug("Claims present: {Claims}", 
                string.Join(", ", context.User.Claims.Select(c => $"{c.Type}={c.Value}")));

            // Try multiple claim type variations
            var subject = context.User.FindFirst("sub")?.Value 
                        ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            
            var email = context.User.FindFirst("email")?.Value 
                     ?? context.User.FindFirst(ClaimTypes.Email)?.Value;

            var issuer = context.User.FindFirst("iss")?.Value ?? string.Empty;
            // Provider hint: Cognito native users emit cognito:username; social users include provider in identities claim (JSON). Use cognito:username as a lightweight hint.
            var provider = context.User.FindFirst("cognito:username")?.Value ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(subject))
            {
                // Check if user exists
                var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Subject == subject && u.Issuer == issuer);

                if (user == null)
                {
                    // Create new user (JIT provisioning)
                    user = new User
                    {
                        Id = Guid.NewGuid(),
                        Subject = subject,
                        Issuer = issuer,
                        Provider = provider,
                        Email = email ?? string.Empty,
                        LastLoginAt = DateTimeOffset.UtcNow,
                        CreatedAt = DateTimeOffset.UtcNow
                    };

                    dbContext.Users.Add(user);
                    await dbContext.SaveChangesAsync();

                    _logger.LogInformation("JIT provisioned user {Subject} with ID {UserId}", subject, user.Id);
                }
                else
                {
                    // Update mutable fields
                    var updated = false;
                    if (!string.IsNullOrWhiteSpace(email) && !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
                    {
                        user.Email = email;
                        updated = true;
                    }
                    if (!string.IsNullOrWhiteSpace(provider) && !string.Equals(user.Provider, provider, StringComparison.OrdinalIgnoreCase))
                    {
                        user.Provider = provider;
                        updated = true;
                    }
                    user.LastLoginAt = DateTimeOffset.UtcNow;
                    updated = true;

                    if (updated)
                    {
                        await dbContext.SaveChangesAsync();
                    }
                }

                // Add userId claim to ClaimsIdentity for downstream use
                var identity = context.User.Identity as ClaimsIdentity;
                if (identity != null && !context.User.HasClaim(c => c.Type == "userId"))
                {
                    identity.AddClaim(new Claim("userId", user.Id.ToString()));
                }
            }
        }

        await _next(context);
    }
}
