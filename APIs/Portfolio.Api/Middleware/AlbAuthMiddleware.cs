using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Portfolio.Api.Middleware;

/// <summary>
/// Middleware to trust ALB-injected OIDC headers when the request originates
/// from a trusted proxy (ALB). Parses `x-amzn-oidc-data` and populates
/// HttpContext.User when appropriate.
/// </summary>
public class AlbAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AlbAuthMiddleware> _logger;
    private readonly IConfiguration _config;

    public AlbAuthMiddleware(RequestDelegate next, ILogger<AlbAuthMiddleware> logger, IConfiguration config)
    {
        _next = next;
        _logger = logger;
        _config = config;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            // Prefer any JwtBearer-populated principal
            if (context.User?.Identity?.IsAuthenticated == true)
            {
                await _next(context);
                return;
            }

            if (context.Request.Headers.TryGetValue("x-amzn-oidc-data", out var encodedData) && !string.IsNullOrWhiteSpace(encodedData))
            {
                var trustedCidrsConfig = _config["TrustedProxyCidrs"] ?? Environment.GetEnvironmentVariable("TRUSTED_PROXY_CIDRS");

                var remoteIp = context.Connection.RemoteIpAddress;
                if (!string.IsNullOrEmpty(trustedCidrsConfig))
                {
                    var cidrs = trustedCidrsConfig.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    bool allowed = false;
                    if (remoteIp != null)
                    {
                        foreach (var cidr in cidrs)
                        {
                            if (IsInCidr(remoteIp, cidr))
                            {
                                allowed = true;
                                break;
                            }
                        }
                    }

                    if (!allowed)
                    {
                        _logger.LogWarning("Rejecting request with ALB auth header because remote IP {RemoteIp} is not in trusted proxies: {Cidrs}", remoteIp, trustedCidrsConfig);
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsync("Forbidden");
                        return;
                    }
                }

                try
                {
                    // base64url -> base64
                    string s = encodedData.ToString();
                    s = s.Replace('-', '+').Replace('_', '/');
                    switch (s.Length % 4)
                    {
                        case 2: s += "=="; break;
                        case 3: s += "="; break;
                    }

                    var bytes = Convert.FromBase64String(s);
                    var json = Encoding.UTF8.GetString(bytes);

                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    var claims = new List<Claim>();

                    foreach (var prop in root.EnumerateObject())
                    {
                        if (prop.Value.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var v in prop.Value.EnumerateArray())
                            {
                                claims.Add(new Claim(prop.Name, v.ToString()));
                            }
                        }
                        else
                        {
                            claims.Add(new Claim(prop.Name, prop.Value.ToString()));
                        }
                    }

                    if (claims.Count > 0)
                    {
                        var identity = new ClaimsIdentity(claims, "ALB");
                        context.User = new ClaimsPrincipal(identity);
                        _logger.LogInformation("Populated HttpContext.User from ALB headers (scheme=ALB). Claims count={Count}", claims.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse x-amzn-oidc-data header; skipping ALB header authentication.");
                }
            }
        }
        catch { }

        await _next(context);
    }

    private static bool IsInCidr(System.Net.IPAddress address, string cidr)
    {
        try
        {
            var parts = cidr.Split('/');
            var baseAddr = System.Net.IPAddress.Parse(parts[0]);
            var prefix = int.Parse(parts[1]);

            var addrBytes = address.GetAddressBytes();
            var baseBytes = baseAddr.GetAddressBytes();
            if (addrBytes.Length != baseBytes.Length) return false;

            int bytes = prefix / 8;
            int bits = prefix % 8;

            for (int i = 0; i < bytes; i++)
            {
                if (addrBytes[i] != baseBytes[i]) return false;
            }

            if (bits > 0)
            {
                int mask = (byte)(~(0xFF >> bits));
                if ((addrBytes[bytes] & mask) != (baseBytes[bytes] & mask)) return false;
            }

            return true;
        }
        catch
        {
            return false;
        }
    }
}
