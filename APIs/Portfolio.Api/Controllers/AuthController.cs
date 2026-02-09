using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IConfiguration configuration, ILogger<AuthController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Get public authentication configuration for the frontend.
    /// Returns Cognito domain, client ID, and redirect URI.
    /// </summary>
    [HttpGet("config")]
    [AllowAnonymous]
    public IActionResult GetAuthConfig()
    {
        try
        {
            var cognitoConfig = _configuration.GetSection("Aws:Cognito");
            var domain = cognitoConfig["Domain"];
            var clientId = cognitoConfig["ClientId"];

            if (string.IsNullOrWhiteSpace(domain) || string.IsNullOrWhiteSpace(clientId))
            {
                _logger.LogError("Cognito configuration is incomplete");
                return StatusCode(500, new { error = "Server configuration error" });
            }

            // Frontend will assemble full URL; only provide relative callback route
            var redirectPath = "/auth/callback";

            return Ok(new
            {
                domain,
                clientId,
                redirectPath
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error in auth config");
            return StatusCode(500, new { error = "Failed to retrieve auth configuration" });
        }
    }
}
