using System.Security.Claims;

namespace Portfolio.Api.Services;

public interface ICurrentUserProvider
{
    Guid GetUserId(HttpContext context);
    string GetCognitoSub(HttpContext context);
    string GetEmail(HttpContext context);
}

public class CurrentUserProvider : ICurrentUserProvider
{
    public Guid GetUserId(HttpContext context)
    {
        // In development, allow debug header
        if (context.Request.Headers.TryGetValue("X-Debug-UserId", out var debugUserId))
        {
            if (Guid.TryParse(debugUserId, out var parsedId))
            {
                return parsedId;
            }
        }

        // Extract from JWT claims
        var userIdClaim = context.User.FindFirst("userId") ?? context.User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }

        return Guid.Empty;
    }

    public string GetCognitoSub(HttpContext context)
    {
        return context.User.FindFirst("sub")?.Value ?? string.Empty;
    }

    public string GetEmail(HttpContext context)
    {
        return context.User.FindFirst("email")?.Value ?? context.User.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty;
    }
}
