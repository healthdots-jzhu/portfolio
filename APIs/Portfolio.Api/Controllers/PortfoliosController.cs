    // ...existing code...
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Models;
using Portfolio.Api.Services;


namespace Portfolio.Api.Controllers;



[ApiController]
[Route("api/[controller]")]
public class PortfoliosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ICurrentUserProvider _currentUser;
    private readonly IConfiguration _configuration;
    private readonly IS3Service _s3Service;
    private readonly IShortIdGenerator _shortIdGenerator;

    public PortfoliosController(AppDbContext context, ICurrentUserProvider currentUser, IConfiguration configuration, IS3Service s3Service, IShortIdGenerator shortIdGenerator)
    {
        _context = context;
        _currentUser = currentUser;
        _configuration = configuration;
        _s3Service = s3Service;
        _shortIdGenerator = shortIdGenerator;
    }

    [HttpPost("{personId}/assets")]
    [RequestSizeLimit(10_000_000)] // 10MB limit
    public async Task<IActionResult> UploadAsset(string personId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Where(p => p.PersonId == personId && p.OwnerId == userId && p.IsActive)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        if (Request.Form.Files.Count == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        var file = Request.Form.Files[0];
        if (file.Length == 0)
        {
        // Removed duplicate and misplaced GetLocalePreview method and XML comment
            return BadRequest(new { error = "Empty file" });
        }

        int maxFiles = _configuration.GetValue<int>("PortfolioAssetLimits:MaxFilesPerPortfolio", 200);
        long maxFileSize = _configuration.GetValue<long>("PortfolioAssetLimits:MaxFileSizeBytes", 10485760);
        if (file.Length > maxFileSize)
        {
            return BadRequest(new { error = $"File size exceeds the maximum allowed size of {maxFileSize / (1024 * 1024)} MB." });
        }
        int assetCount = await _context.PortfolioAssets.CountAsync(a => a.PortfolioId == portfolio.Id);
        if (assetCount >= maxFiles)
        {
            return BadRequest(new { error = $"This portfolio already has the maximum allowed number of assets ({maxFiles}). Please delete an asset before uploading a new one." });
        }

        var allowedTypes = new[] {
            // Images
            "image/png", "image/jpeg", "image/gif", "image/webp",
            // Videos
            "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm",
            // Documents
            "application/pdf",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        };
        if (!allowedTypes.Contains(file.ContentType))
        {
            return BadRequest(new { error = "Unsupported file type" });
        }

        // Validate file signature (magic bytes)
        using (var fileStream = file.OpenReadStream())
        {
            if (!Portfolio.Api.Utils.FileSignatureValidator.IsValidSignature(fileStream, file.ContentType))
            {
                return BadRequest(new { error = "File content does not match its type (possible fake or corrupt file)" });
            }
        }

        // Use same S3 key logic as S3Service (use PersonId so keys are stable and human-readable)
        string sanitizedFileName = SanitizeFileName(file.FileName);
        string sanitizedPortfolioId = SanitizePathSegment(portfolio.PersonId);
        var s3Key = $"img/{sanitizedPortfolioId}/{sanitizedFileName}";
        if (await _s3Service.AssetExistsAsync(s3Key))
        {
            return Conflict(new { error = "A file with the same name already exists. Please rename your file or delete the existing one before uploading." });
        }

        // Upload to S3 (pass PersonId to place object under img/{personId}/...)
        await _s3Service.UploadAssetAsync(portfolio.PersonId, file.FileName, file.OpenReadStream(), file.ContentType);

        // Create asset record
        var asset = new Portfolio.Api.Models.PortfolioAsset
        {
            Id = Guid.NewGuid(),
            PortfolioId = portfolio.Id,
            AssetKey = s3Key,
            FileType = file.ContentType,
            FileSize = file.Length,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _context.PortfolioAssets.Add(asset);
        portfolio.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            asset.Id,
            asset.AssetKey,
            asset.FileType,
            asset.FileSize,
            asset.CreatedAt,
            url = _s3Service.GetCloudFrontUrl(s3Key)
        });
    }

    [HttpDelete("{personId}/assets/{assetId}")]
    public async Task<IActionResult> DeleteAsset(string personId, Guid assetId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Where(p => p.PersonId == personId && p.OwnerId == userId && p.IsActive)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        var asset = await _context.PortfolioAssets.FirstOrDefaultAsync(a => a.Id == assetId && a.PortfolioId == portfolio.Id);
        if (asset == null)
        {
            return NotFound(new { error = "Asset not found" });
        }

        // Attempt to delete the S3 object; log but don't fail the request if deletion fails
        try
        {
            await _s3Service.DeleteObjectAsync(asset.AssetKey);
        }
        catch (Exception ex)
        {
            // Log and continue to remove DB record to keep state consistent
            // Using ILogger would be preferable; for now we rely on middleware logs.
        }

        _context.PortfolioAssets.Remove(asset);
        portfolio.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalidChars = System.IO.Path.GetInvalidFileNameChars();
        return string.Join("_", fileName.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries));
    }

    private static string SanitizePathSegment(string segment)
    {
        var invalidChars = System.IO.Path.GetInvalidPathChars();
        return string.Join("_", segment.Replace('/', '_').Replace('\\', '_').Split(invalidChars, StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>
    /// Get portfolios owned by the authenticated user (or all if admin).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPortfolios()
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolios = await _context.Portfolios
            .Where(p => p.OwnerId == userId && p.IsActive)
            .Select(p => new
            {
                p.Id,
                p.PersonId,
                p.DisplayName,
                p.Subdomain,
                p.IsActive,
                p.CreatedAt,
                p.UpdatedAt,
                LocaleCount = p.Locales.Count,
                AssetCount = p.Assets.Count
            })
            .ToListAsync();

        return Ok(portfolios);
    }

    /// <summary>
    /// Get portfolio for editing by personId (authenticated).
    /// Ensures the S3 folder exists for this portfolio.
    /// </summary>
    [HttpGet("edit/{personId}")]
    public async Task<IActionResult> GetPortfolioForEdit(string personId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Include(p => p.Locales)
            .Where(p => p.PersonId == personId && p.OwnerId == userId && p.IsActive)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        var availableLanguages = portfolio.Locales
            .Where(l => !string.IsNullOrWhiteSpace(l.ContentJson) && l.ContentJson != "{}")
            .Select(l => l.Language)
            .Distinct()
            .OrderBy(l => l)
            .ToList();

        var assets = await _context.PortfolioAssets
            .Where(a => a.PortfolioId == portfolio.Id)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new {
                a.Id,
                a.AssetKey,
                a.FileType,
                a.FileSize,
                a.CreatedAt,
                Url = _s3Service.GetCloudFrontUrl(a.AssetKey)
            })
            .ToListAsync();

        return Ok(new
        {
            portfolio.Id,
            portfolio.PersonId,
            portfolio.DisplayName,
            portfolio.Subdomain,
            portfolio.CreatedAt,
            portfolio.UpdatedAt,
            AvailableLanguages = availableLanguages,
            Assets = assets
        });
    }

    /// <summary>
    /// Get public portfolio metadata by personId.
    /// </summary>
    [HttpGet("{personId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPortfolio(string personId)
    {
        var portfolio = await _context.Portfolios
            .Include(p => p.Locales)
            .Where(p => p.PersonId == personId && p.IsActive)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found" });
        }

        var availableLanguages = portfolio.Locales
            .Where(l => !string.IsNullOrWhiteSpace(l.ContentJson) && l.ContentJson != "{}")
            .Select(l => l.Language)
            .Distinct()
            .OrderBy(l => l)
            .ToList();

        return Ok(new
        {
            portfolio.Id,
            portfolio.PersonId,
            portfolio.DisplayName,
            portfolio.Subdomain,
            portfolio.CreatedAt,
            AvailableLanguages = availableLanguages
        });
    }

    /// <summary>
    /// Get locale content for a portfolio by personId and language.
    /// </summary>
    [HttpGet("{personId}/locales/{language}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLocale(string personId, string language)
    {
        var locale = await _context.PortfolioLocales
            .Include(l => l.Portfolio)
            .Where(l => l.Portfolio.PersonId == personId && l.Portfolio.IsActive && l.Language == language)
            .FirstOrDefaultAsync();

        if (locale == null)
        {
            return NotFound(new { error = "Locale not found" });
        }

        return Content(locale.ContentJson, "application/json");
    }

    /// <summary>
    /// Get locale content for a specific version (for preview).
    /// Requires authentication to preview staged/draft versions.
    /// Returns empty object {} if language doesn't exist yet.
    /// </summary>
    [HttpGet("{personId}/preview/{versionId}/locales/{language}")]
    public async Task<IActionResult> GetLocalePreview(string personId, int versionId, string language)
    {

        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Where(p => p.PersonId == personId && p.OwnerId == userId && p.IsActive)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        if (Request.Form.Files.Count == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        var file = Request.Form.Files[0];
        if (file.Length == 0)
        {
            return BadRequest(new { error = "Empty file" });
        }

        int maxFiles = _configuration.GetValue<int>("PortfolioAssetLimits:MaxFilesPerPortfolio", 200);
        long maxFileSize = _configuration.GetValue<long>("PortfolioAssetLimits:MaxFileSizeBytes", 10485760);
        if (file.Length > maxFileSize)
        {
            return BadRequest(new { error = $"File size exceeds the maximum allowed size of {maxFileSize / (1024 * 1024)} MB." });
        }
        int assetCount = await _context.PortfolioAssets.CountAsync(a => a.PortfolioId == portfolio.Id);
        if (assetCount >= maxFiles)
        {
            return BadRequest(new { error = $"This portfolio already has the maximum allowed number of assets ({maxFiles}). Please delete an asset before uploading a new one." });
        }
        // Ensure a return value for all code paths
        return Content("{}", "application/json");
    }
    [HttpDelete("{personId}")]
    public async Task<IActionResult> DeletePortfolio(string personId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Where(p => p.PersonId == personId && p.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        portfolio.IsActive = false;
        portfolio.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Portfolio deactivated successfully" });
    }

    // Create a new portfolio for the authenticated user.
    [HttpPost]
    public async Task<IActionResult> CreatePortfolio([FromBody] Portfolio.Api.Models.Dto.CreatePortfolioRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        // Generate personId if not provided
        var personId = request.PreferredPersonId ?? $"portfolio-{Guid.NewGuid().ToString("N")[..8]}";

        // Check if personId already exists
        if (await _context.Portfolios.AnyAsync(p => p.PersonId == personId))
        {
            return BadRequest(new { error = "PersonId already exists" });
        }

        // Atomically fetch next sequence value from database to avoid races
        var nextSequentialId = await GetNextSequentialIdAsync();
        var shortId = _shortIdGenerator.Encode(nextSequentialId);

        var portfolio = new Portfolio.Api.Models.Portfolio
        {
            Id = shortId,
            SequentialId = nextSequentialId,
            PersonId = personId,
            DisplayName = request.DisplayName,
            Subdomain = request.Subdomain,
            OwnerId = userId,
            IsActive = true
        };

        _context.Portfolios.Add(portfolio);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPortfolio), new { personId = portfolio.PersonId }, new
        {
            Id = shortId,
            portfolio.PersonId,
            portfolio.DisplayName,
            portfolio.Subdomain,
            portfolio.IsActive
        });
    }

    // Fetch next sequence value from PostgreSQL for Portfolios.SequentialId to avoid race conditions.
    private async Task<long> GetNextSequentialIdAsync()
    {
        var connection = _context.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;

        if (shouldClose)
        {
            await connection.OpenAsync();
        }

        await using var command = connection.CreateCommand();
        command.CommandText = @"SELECT nextval(pg_get_serial_sequence('""Portfolios""', 'SequentialId'))";

        var result = await command.ExecuteScalarAsync();

        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        return Convert.ToInt64(result);
    }

    /// <summary>
    /// Update portfolio metadata.
    /// </summary>
    [HttpPut("{personId}")]
    public async Task<IActionResult> UpdatePortfolio(string personId, [FromBody] Portfolio.Api.Models.Dto.UpdatePortfolioRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Where(p => p.PersonId == personId && p.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        if (request.DisplayName != null) portfolio.DisplayName = request.DisplayName;
        if (request.Subdomain != null) portfolio.Subdomain = request.Subdomain;
        if (request.IsActive.HasValue) portfolio.IsActive = request.IsActive.Value;

        portfolio.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            portfolio.Id,
            portfolio.PersonId,
            portfolio.DisplayName,
            portfolio.Subdomain,
            portfolio.IsActive,
            portfolio.UpdatedAt
        });
    }

    /// <summary>
    /// Update or create locale content for a portfolio.
    /// </summary>
    [HttpPut("{personId}/locales/{language}")]
    public async Task<IActionResult> UpdateLocale(string personId, string language, [FromBody] Portfolio.Api.Models.Dto.UpdateLocaleRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Include(p => p.Locales)
            .Where(p => p.PersonId == personId && p.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        var locale = await _context.PortfolioLocales
            .Where(l => l.PortfolioId == portfolio.Id && l.Language == language)
            .FirstOrDefaultAsync();

        // If content is blank/empty, remove the locale
        if (string.IsNullOrWhiteSpace(request.ContentJson) || request.ContentJson == "{}")
        {
            if (locale != null)
            {
                _context.PortfolioLocales.Remove(locale);
                portfolio.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Locale removed successfully", language });
            }
            return Ok(new { message = "Locale already empty", language });
        }

        if (locale == null)
        {
            locale = new PortfolioLocale
            {
                Id = Guid.NewGuid(),
                PortfolioId = portfolio.Id,
                Language = language,
                ContentJson = request.ContentJson
            };
            _context.PortfolioLocales.Add(locale);
        }
        else
        {
            locale.ContentJson = request.ContentJson;
            locale.UpdatedAt = DateTimeOffset.UtcNow;
        }

        portfolio.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Locale updated successfully", language, updatedAt = locale.UpdatedAt });
    }
}
