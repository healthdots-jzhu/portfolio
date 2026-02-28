    // ...existing code...
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Models;
using Portfolio.Api.Services;
using Portfolio.Api.Models.Dto;


namespace Portfolio.Api.Controllers;



[ApiController]
[Route("api/[controller]")]
public class PortfoliosController : ControllerBase
{
    private static readonly Lazy<string> _cachedSystemPrompt = new Lazy<string>(() =>
    {
        try
        {
            var promptPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Prompts", "system-prompt.txt");
            return System.IO.File.ReadAllText(promptPath);
        }
        catch
        {
            return string.Empty;
        }
    });

    private readonly AppDbContext _context;
    private readonly ICurrentUserProvider _currentUser;
    private readonly IConfiguration _configuration;
    private readonly IS3Service _s3Service;
    private readonly IShortIdGenerator _shortIdGenerator;
    private readonly IGitHubModelsService _gitHubModelsService;
    private readonly ILocaleValidator _localeValidator;
    private readonly ILogger<PortfoliosController> _logger;

    public PortfoliosController(AppDbContext context, ICurrentUserProvider currentUser, IConfiguration configuration, IS3Service s3Service, IShortIdGenerator shortIdGenerator, IGitHubModelsService gitHubModelsService, ILocaleValidator localeValidator, ILogger<PortfoliosController> logger)
    {
        _context = context;
        _currentUser = currentUser;
        _configuration = configuration;
        _s3Service = s3Service;
        _shortIdGenerator = shortIdGenerator;
        _gitHubModelsService = gitHubModelsService;
        _localeValidator = localeValidator;
        _logger = logger;
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

        // Normalize content type from file extension when the browser sends a generic type
        // (e.g. image/avif is not registered on all OS, so Windows may send application/octet-stream)
        var contentType = file.ContentType?.ToLowerInvariant();
        if (string.IsNullOrEmpty(contentType) || contentType == "application/octet-stream")
        {
            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant();
            contentType = ext switch
            {
                ".avif" => "image/avif",
                ".png"  => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif"  => "image/gif",
                ".webp" => "image/webp",
                ".mp4"  => "video/mp4",
                ".mov"  => "video/quicktime",
                ".avi"  => "video/x-msvideo",
                ".mkv"  => "video/x-matroska",
                ".webm" => "video/webm",
                ".pdf"  => "application/pdf",
                ".doc"  => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls"  => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                _ => contentType ?? string.Empty
            };
        }

        var allowedTypes = new[] {
            // Images
            "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/avif-sequence",
            // Videos
            "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm",
            // Documents
            "application/pdf",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        };
        if (!allowedTypes.Contains(contentType))
        {
            return BadRequest(new { error = "Unsupported file type" });
        }

        // Validate file signature (magic bytes)
        using (var fileStream = file.OpenReadStream())
        {
            if (!Portfolio.Api.Utils.FileSignatureValidator.IsValidSignature(fileStream, contentType))
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
        await _s3Service.UploadAssetAsync(portfolio.PersonId, file.FileName, file.OpenReadStream(), contentType);

        // Create asset record
        var asset = new Portfolio.Api.Models.PortfolioAsset
        {
            Id = Guid.NewGuid(),
            PortfolioId = portfolio.Id,
            AssetKey = s3Key,
            FileType = contentType,
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
        catch (Exception)
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

    /// <summary>
    /// Generate locale content from a free-form prompt using GitHub Models.
    /// Supports targeted area updates, versioning, and multi-language generation.
    /// </summary>
    [HttpPost("{personId}/locales/{language}/generate")]
    public async Task<IActionResult> GenerateLocaleFromPrompt(string personId, string language, [FromBody] GenerateLocaleRequest request)
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

        if (request == null || string.IsNullOrWhiteSpace(request.Prompt))
        {
            return BadRequest(new { error = "Prompt is required" });
        }

        // Limit prompt length to avoid abuse
        var maxPromptLength = _configuration.GetValue<int>("GitHubModels:MaxPromptLength", 4000);
        if (request.Prompt.Length > maxPromptLength)
        {
            return BadRequest(new { error = $"Prompt too long (max {maxPromptLength} characters)" });
        }

        // Area to JSON path mapping
        var areaMapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Languages", "common.languages" },
            { "Menu", "common.menu" },
            { "Footer", "common.footer" },
            { "Showcase Pages", "common.showcases" },
            { "Theme", "theme" },
            { "Home Page", "home" },
            { "About Me Page", "about" },
            { "Engagements Page", "engagements" },
            { "Specialties Page", "specialties" }
        };

        // Get cached system prompt
        var systemPrompt = _cachedSystemPrompt.Value;
        if (string.IsNullOrEmpty(systemPrompt))
        {
            _logger.LogError("System prompt file not found or empty");
            return StatusCode(500, new { error = "Failed to load system configuration" });
        }

        // Determine languages to process
        var targetLanguages = request.Languages?.Any() == true ? request.Languages : new List<string> { language };

        // Determine if we're working with a version or live
        bool isLive = !request.VersionId.HasValue;
        int? targetVersionId = request.VersionId;
        PortfolioVersion? targetVersion = null;

        if (!isLive)
        {
            targetVersion = await _context.PortfolioVersions
                .Where(v => v.Id == request.VersionId && v.PortfolioId == portfolio.Id)
                .FirstOrDefaultAsync();

            if (targetVersion == null)
            {
                return NotFound(new { error = "Version not found" });
            }

            // Check if version is read-only
            if (targetVersion.Status == VersionStatus.Published || targetVersion.Status == VersionStatus.Archived)
            {
                return BadRequest(new { error = "Cannot modify published or archived versions" });
            }
        }

        // Process all languages (all-or-nothing approach)
        var updatedLocales = new Dictionary<string, string>();
        var maxTokens = _configuration.GetValue<int?>("GitHubModels:MaxTokens");
        var temperature = _configuration.GetValue<double?>("GitHubModels:Temperature");
        var options = new GitHubModelOptions { MaxTokens = maxTokens, Temperature = temperature, SystemPrompt = systemPrompt };

        try
        {
            foreach (var lang in targetLanguages)
            {
                // Get current content for this language
                string currentContent;
                if (isLive)
                {
                    var locale = portfolio.Locales.FirstOrDefault(l => l.Language == lang);
                    currentContent = locale?.ContentJson ?? "{}";
                }
                else
                {
                    // Extract from version snapshot
                    currentContent = "{}";
                    if (!string.IsNullOrWhiteSpace(targetVersion!.LocaleSnapshot))
                    {
                        using var doc = System.Text.Json.JsonDocument.Parse(targetVersion.LocaleSnapshot);
                        if (doc.RootElement.TryGetProperty(lang, out var langElement))
                        {
                            currentContent = langElement.GetRawText();
                        }
                    }
                }

                // Extract the area section if specified
                string sectionJson = currentContent;
                if (!string.IsNullOrWhiteSpace(request.Area) && areaMapping.TryGetValue(request.Area, out var jsonPath))
                {
                    sectionJson = ExtractJsonSection(currentContent, jsonPath);
                }

                // Build enhanced prompt with section context
                var enhancedPrompt = $"{request.Prompt}\n\nBelow is the configuration json data for the request. Return the full revised json data without any summary/reasoning/other information in the response. Do not change the order of the fields unless it's requested as part of the prompt.\n\n{sectionJson}";

                // Call GitHub Models API
                var generatedJson = await _gitHubModelsService.GenerateLocaleJsonAsync(enhancedPrompt, lang, options, HttpContext.RequestAborted);

                // Merge the generated section back if area was specified
                string finalJson;
                if (!string.IsNullOrWhiteSpace(request.Area) && areaMapping.TryGetValue(request.Area, out var mergePath))
                {
                    finalJson = MergeJsonSection(currentContent, mergePath, generatedJson);
                }
                else
                {
                    // For full content replacement, reformat to ensure indentation
                    var serializeOptions = new System.Text.Json.JsonSerializerOptions 
                    { 
                        WriteIndented = true,
                        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                    };
                    finalJson = System.Text.Json.JsonSerializer.Serialize(
                        System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonNode>(generatedJson),
                        serializeOptions
                    );
                }

                // Validate the full merged JSON
                var validation = _localeValidator.ValidateLocale(finalJson, lang);
                if (!validation.IsValid)
                {
                    return UnprocessableEntity(new 
                    { 
                        error = $"Validation failed for language '{lang}'",
                        language = lang,
                        generated = finalJson, 
                        validation 
                    });
                }

                updatedLocales[lang] = finalJson;
            }

            // All validations passed - persist changes
            if (isLive)
            {
                // Update live locales and create a new draft version
                foreach (var kvp in updatedLocales)
                {
                    var locale = portfolio.Locales.FirstOrDefault(l => l.Language == kvp.Key);
                    if (locale == null)
                    {
                        locale = new PortfolioLocale
                        {
                            Id = Guid.NewGuid(),
                            PortfolioId = portfolio.Id,
                            Language = kvp.Key,
                            ContentJson = kvp.Value,
                            UpdatedAt = DateTimeOffset.UtcNow
                        };
                        _context.PortfolioLocales.Add(locale);
                    }
                    else
                    {
                        locale.ContentJson = kvp.Value;
                        locale.UpdatedAt = DateTimeOffset.UtcNow;
                    }
                }

                portfolio.UpdatedAt = DateTimeOffset.UtcNow;
                await _context.SaveChangesAsync();

                // Create new draft version snapshot
                var newVersion = await CreateVersionSnapshot(portfolio.Id, userId, "AI-generated changes");
                
                return Ok(new 
                { 
                    message = "Locales updated and draft version created",
                    versionId = newVersion.Id,
                    languages = targetLanguages,
                    updatedAt = DateTimeOffset.UtcNow
                });
            }
            else
            {
                // Update existing version snapshot
                var snapshotNode = string.IsNullOrWhiteSpace(targetVersion!.LocaleSnapshot) || targetVersion.LocaleSnapshot == "{}"
                    ? new System.Text.Json.Nodes.JsonObject()
                    : System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonObject>(targetVersion.LocaleSnapshot)!;
                
                // Update with new content
                foreach (var kvp in updatedLocales)
                {
                    var localeNode = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonNode>(kvp.Value);
                    snapshotNode[kvp.Key] = localeNode;
                }

                var serializeOptions = new System.Text.Json.JsonSerializerOptions 
                { 
                    WriteIndented = true,
                    Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                };
                targetVersion.LocaleSnapshot = System.Text.Json.JsonSerializer.Serialize(snapshotNode, serializeOptions);
                await _context.SaveChangesAsync();

                return Ok(new 
                { 
                    message = "Version updated successfully",
                    versionId = targetVersion.Id,
                    languages = targetLanguages,
                    updatedAt = DateTimeOffset.UtcNow
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI generation failed");
            return StatusCode(502, new { error = "Model generation failed", detail = ex.Message });
        }
    }

    private string ExtractJsonSection(string fullJson, string jsonPath)
    {
        using var doc = System.Text.Json.JsonDocument.Parse(fullJson);
        var element = doc.RootElement;
        
        foreach (var segment in jsonPath.Split('.'))
        {
            if (element.TryGetProperty(segment, out var prop))
            {
                element = prop;
            }
            else
            {
                return "{}";
            }
        }
        
        return element.GetRawText();
    }

    private string MergeJsonSection(string fullJson, string jsonPath, string sectionJson)
    {
        // Parse both the full JSON and the section to merge
        using var fullDoc = System.Text.Json.JsonDocument.Parse(fullJson);
        using var sectionDoc = System.Text.Json.JsonDocument.Parse(sectionJson);
        
        // Use a writable DOM to perform the merge
        var rootElement = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonNode>(fullJson);
        if (rootElement == null)
        {
            throw new InvalidOperationException("Failed to parse full JSON");
        }
        
        var pathSegments = jsonPath.Split('.');
        System.Text.Json.Nodes.JsonNode? current = rootElement;
        
        // Navigate to the parent of the target property
        for (int i = 0; i < pathSegments.Length - 1; i++)
        {
            var segment = pathSegments[i];
            if (current is System.Text.Json.Nodes.JsonObject obj)
            {
                if (!obj.ContainsKey(segment))
                {
                    obj[segment] = new System.Text.Json.Nodes.JsonObject();
                }
                current = obj[segment];
            }
            else
            {
                throw new InvalidOperationException($"Cannot navigate through path segment '{segment}'");
            }
        }
        
        // Set the target property with the new section
        if (current is System.Text.Json.Nodes.JsonObject targetObj)
        {
            var finalSegment = pathSegments[^1];
            var sectionNode = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonNode>(sectionJson);
            targetObj[finalSegment] = sectionNode;
        }
        else
        {
            throw new InvalidOperationException("Target parent is not a JSON object");
        }
        
        // Serialize with indentation for readability
        var options = new System.Text.Json.JsonSerializerOptions 
        { 
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };
        return System.Text.Json.JsonSerializer.Serialize(rootElement, options);
    }

    private async Task<PortfolioVersion> CreateVersionSnapshot(string portfolioId, Guid creatorId, string? description)
    {
        var portfolio = await _context.Portfolios
            .Include(p => p.Locales)
            .FirstOrDefaultAsync(p => p.Id == portfolioId);

        if (portfolio == null)
        {
            throw new InvalidOperationException("Portfolio not found");
        }

        var nextVersionNumber = await _context.PortfolioVersions
            .Where(v => v.PortfolioId == portfolioId)
            .MaxAsync(v => (int?)v.VersionNumber) ?? 0;

        var snapshot = new Dictionary<string, string>();
        foreach (var locale in portfolio.Locales)
        {
            if (!string.IsNullOrWhiteSpace(locale.ContentJson) && locale.ContentJson != "{}")
            {
                snapshot[locale.Language] = locale.ContentJson;
            }
        }

        var serializeOptions = new System.Text.Json.JsonSerializerOptions 
        { 
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        var version = new PortfolioVersion
        {
            PortfolioId = portfolioId,
            VersionNumber = nextVersionNumber + 1,
            Status = VersionStatus.Draft,
            ChangeDescription = description,
            LocaleSnapshot = System.Text.Json.JsonSerializer.Serialize(snapshot, serializeOptions),
            CreatedBy = creatorId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.PortfolioVersions.Add(version);
        await _context.SaveChangesAsync();

        return version;
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

        // Generate personId if not provided (do not add 'portfolio-' prefix)
        var personId = request.PreferredPersonId ?? Guid.NewGuid().ToString("N")[..8];

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
