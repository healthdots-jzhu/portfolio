using Microsoft.AspNetCore.Mvc;
using Portfolio.Api.Models.Dto;
using Portfolio.Api.Services;
using System.Text.Json;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/portfolios/{portfolioId}/versions")]
public class VersionsController : ControllerBase
{
    private readonly IVersionService _versionService;
    private readonly ILocaleValidator _localeValidator;
    private readonly ICurrentUserProvider _currentUser;
    private readonly ILogger<VersionsController> _logger;

    public VersionsController(
        IVersionService versionService,
        ILocaleValidator localeValidator,
        ICurrentUserProvider currentUser,
        ILogger<VersionsController> logger)
    {
        _versionService = versionService;
        _localeValidator = localeValidator;
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <summary>
    /// Get version history for a portfolio
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetVersionHistory(string portfolioId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var history = await _versionService.GetVersionHistoryAsync(portfolioId);
        return Ok(history);
    }

    /// <summary>
    /// Get details of a specific version
    /// </summary>
    [HttpGet("{versionId}")]
    public async Task<IActionResult> GetVersion(string portfolioId, int versionId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var version = await _versionService.GetVersionAsync(versionId);
        if (version == null || version.PortfolioId != portfolioId)
        {
            return NotFound(new { error = "Version not found" });
        }

        Dictionary<string, object>? localeContent = null;
        try
        {
            localeContent = JsonSerializer.Deserialize<Dictionary<string, object>>(version.LocaleSnapshot);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deserializing locale snapshot for version {VersionId}", versionId);
        }

        var detail = new VersionDetail
        {
            Id = version.Id,
            VersionNumber = version.VersionNumber,
            Status = version.Status,
            Label = version.Label,
            ChangeDescription = version.ChangeDescription,
            LocaleContent = localeContent ?? new Dictionary<string, object>(),
            CreatedAt = version.CreatedAt,
            PublishedAt = version.PublishedAt,
            IsCurrentPublished = version.IsCurrentPublished,
            CreatorName = version.Creator?.Email ?? "Unknown"
        };

        return Ok(detail);
    }

    /// <summary>
    /// Create a new version (snapshot of current state)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateVersion(string portfolioId, [FromBody] CreateVersionRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        try
        {
            var version = await _versionService.CreateVersionAsync(portfolioId, userId, request);

            return CreatedAtAction(nameof(GetVersion), 
                new { portfolioId, versionId = version.Id }, 
                new
                {
                    version.Id,
                    version.VersionNumber,
                    version.Status,
                    version.Label,
                    version.CreatedAt
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating version for portfolio {PortfolioId}", portfolioId);
            return StatusCode(500, new { error = "Failed to create version" });
        }
    }

    /// <summary>
    /// Publish a version (make it live)
    /// </summary>
    [HttpPost("{versionId}/publish")]
    public async Task<IActionResult> PublishVersion(string portfolioId, int versionId, [FromBody] PublishVersionRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        if (!request.Confirmed)
        {
            return BadRequest(new { error = "Confirmation required to publish" });
        }

        try
        {
            var version = await _versionService.PublishVersionAsync(versionId, userId);
            if (version == null)
            {
                return NotFound(new { error = "Version not found" });
            }

            return Ok(new
            {
                message = "Version published successfully",
                version.Id,
                version.VersionNumber,
                version.PublishedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing version {VersionId}", versionId);
            return StatusCode(500, new { error = "Failed to publish version" });
        }
    }

    /// <summary>
    /// Stage a version for preview
    /// </summary>
    [HttpPost("{versionId}/stage")]
    public async Task<IActionResult> StageVersion(string portfolioId, int versionId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var version = await _versionService.StageVersionAsync(versionId);
        if (version == null)
        {
            return NotFound(new { error = "Version not found" });
        }

        return Ok(new
        {
            message = "Version staged successfully",
            version.Id,
            version.VersionNumber,
            version.Status
        });
    }

    /// <summary>
    /// Unstage a version
    /// </summary>
    [HttpPost("{versionId}/unstage")]
    public async Task<IActionResult> UnstageVersion(string portfolioId, int versionId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var success = await _versionService.UnstageVersionAsync(versionId);
        if (!success)
        {
            return NotFound(new { error = "Version not found or not staged" });
        }

        return Ok(new { message = "Version unstaged successfully" });
    }

    /// <summary>
    /// Get all staged versions for preview
    /// </summary>
    [HttpGet("staged")]
    public async Task<IActionResult> GetStagedVersions(string portfolioId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var stagedVersions = await _versionService.GetStagedVersionsAsync(portfolioId);
        
        var result = stagedVersions.Select(v => new
        {
            v.Id,
            v.VersionNumber,
            v.Status,
            v.Label,
            v.ChangeDescription,
            v.CreatedAt,
            CreatorName = v.Creator?.Email ?? "Unknown"
        });

        return Ok(result);
    }

    /// <summary>
    /// Validate locale content without saving
    /// </summary>
    [HttpPost("validate")]
    public IActionResult ValidateLocale(string portfolioId, [FromBody] ValidateLocaleRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var result = _localeValidator.ValidateLocale(request.ContentJson, request.Language);
        return Ok(result);
    }
}
