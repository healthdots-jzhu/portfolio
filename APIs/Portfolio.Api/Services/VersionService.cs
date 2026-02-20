using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Models;
using Portfolio.Api.Models.Dto;

namespace Portfolio.Api.Services;

public interface IVersionService
{
    Task<PortfolioVersion> CreateVersionAsync(string portfolioId, Guid userId, CreateVersionRequest request);
    Task<PortfolioVersion?> GetVersionAsync(int versionId);
    Task<List<VersionSummary>> GetVersionHistoryAsync(string portfolioId);
    Task<PortfolioVersion?> GetCurrentPublishedVersionAsync(string portfolioId);
    Task<PortfolioVersion?> PublishVersionAsync(int versionId, Guid userId);
    Task<PortfolioVersion?> StageVersionAsync(int versionId);
    Task<bool> UnstageVersionAsync(int versionId);
    Task<List<PortfolioVersion>> GetStagedVersionsAsync(string portfolioId);
    Task<bool> SoftDeleteVersionAsync(int versionId);
    Task<PortfolioVersion?> CopyVersionAsync(int versionId, Guid userId);
    Task<bool> UpdateVersionLocaleAsync(int versionId, string language, string contentJson);
}

public class VersionService : IVersionService
{
    private readonly AppDbContext _context;
    private readonly ILogger<VersionService> _logger;

    public VersionService(AppDbContext context, ILogger<VersionService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<PortfolioVersion> CreateVersionAsync(string portfolioId, Guid userId, CreateVersionRequest request)
    {
        // Get current locale content
        var locales = await _context.PortfolioLocales
            .Where(l => l.PortfolioId == portfolioId)
            .ToListAsync();

        // Create snapshot - preserve field order by building JSON manually from raw strings
        var snapshotParts = new List<string>();
        foreach (var locale in locales)
        {
            // Escape the language key and use the raw ContentJson as-is
            var escapedLanguage = JsonSerializer.Serialize(locale.Language);
            snapshotParts.Add($"{escapedLanguage}:{locale.ContentJson}");
        }
        
        var snapshotJson = "{" + string.Join(",", snapshotParts) + "}";

        // Retry logic for concurrency conflicts
        const int maxRetries = 3;
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                // Get next version number within transaction scope
                var maxVersion = await _context.PortfolioVersions
                    .Where(v => v.PortfolioId == portfolioId)
                    .MaxAsync(v => (int?)v.VersionNumber) ?? 0;

                var version = new PortfolioVersion
                {
                    PortfolioId = portfolioId,
                    VersionNumber = maxVersion + 1,
                    Status = request.Stage ? VersionStatus.Staged : VersionStatus.Draft,
                    Label = request.Label,
                    ChangeDescription = request.ChangeDescription,
                    LocaleSnapshot = snapshotJson,
                    CreatedBy = userId,
                    CreatedAt = DateTimeOffset.UtcNow
                };

                _context.PortfolioVersions.Add(version);
                await _context.SaveChangesAsync();

                return version;
            }
            catch (DbUpdateException ex) when (attempt < maxRetries - 1 && IsUniqueConstraintViolation(ex))
            {
                // Unique constraint violation - retry with new version number
                _logger.LogWarning(ex, "Version number conflict for portfolio {PortfolioId}, attempt {Attempt}", 
                    portfolioId, attempt + 1);
                
                // Clear the failed entity from tracking
                _context.ChangeTracker.Clear();
                
                // Small delay to reduce collision probability
                await Task.Delay(TimeSpan.FromMilliseconds(50 * (attempt + 1)));
            }
        }

        throw new InvalidOperationException($"Failed to create version after {maxRetries} attempts due to concurrency conflicts");
    }

    public async Task<PortfolioVersion?> GetVersionAsync(int versionId)
    {
        return await _context.PortfolioVersions
            .Include(v => v.Creator)
            .FirstOrDefaultAsync(v => v.Id == versionId && !v.IsDeleted);
    }

    public async Task<List<VersionSummary>> GetVersionHistoryAsync(string portfolioId)
    {
        return await _context.PortfolioVersions
            .Where(v => v.PortfolioId == portfolioId && !v.IsDeleted)
            .Include(v => v.Creator)
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new VersionSummary
            {
                Id = v.Id,
                VersionNumber = v.VersionNumber,
                Status = v.Status,
                Label = v.Label,
                ChangeDescription = v.ChangeDescription,
                CreatedAt = v.CreatedAt,
                PublishedAt = v.PublishedAt,
                IsCurrentPublished = v.IsCurrentPublished,
                CreatorName = v.Creator == null ? "Unknown" : (v.Creator.Email ?? "Unknown")
            })
            .ToListAsync();
    }

    public async Task<PortfolioVersion?> GetCurrentPublishedVersionAsync(string portfolioId)
    {
        return await _context.PortfolioVersions
            .Where(v => v.PortfolioId == portfolioId && v.IsCurrentPublished && !v.IsDeleted)
            .FirstOrDefaultAsync();
    }

    public async Task<PortfolioVersion?> PublishVersionAsync(int versionId, Guid userId)
    {
        var version = await _context.PortfolioVersions
            .Include(v => v.Portfolio)
            .FirstOrDefaultAsync(v => v.Id == versionId && !v.IsDeleted);

        if (version == null)
        {
            return null;
        }

        // Begin transaction to ensure atomicity
        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // Unmark current published version
            var currentPublished = await _context.PortfolioVersions
                .Where(v => v.PortfolioId == version.PortfolioId && v.IsCurrentPublished && !v.IsDeleted)
                .FirstOrDefaultAsync();

            if (currentPublished != null)
            {
                currentPublished.IsCurrentPublished = false;
                currentPublished.Status = VersionStatus.Archived;
            }

            // Mark this version as published
            version.Status = VersionStatus.Published;
            version.IsCurrentPublished = true;
            version.PublishedAt = DateTimeOffset.UtcNow;
            version.PublishedBy = userId;

            // Update the actual PortfolioLocales with content from this version
            var snapshot = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(version.LocaleSnapshot);
            if (snapshot != null)
            {
                foreach (var kvp in snapshot)
                {
                    var language = kvp.Key;
                    var content = kvp.Value.GetRawText();

                    var locale = await _context.PortfolioLocales
                        .FirstOrDefaultAsync(l => l.PortfolioId == version.PortfolioId && l.Language == language);

                    if (locale != null)
                    {
                        locale.ContentJson = content;
                        locale.UpdatedAt = DateTimeOffset.UtcNow;
                    }
                    else
                    {
                        // Create new locale if it doesn't exist
                        locale = new PortfolioLocale
                        {
                            Id = Guid.NewGuid(),
                            PortfolioId = version.PortfolioId,
                            Language = language,
                            ContentJson = content,
                            UpdatedAt = DateTimeOffset.UtcNow
                        };
                        _context.PortfolioLocales.Add(locale);
                    }
                }
            }

            // Update portfolio timestamp
            version.Portfolio.UpdatedAt = DateTimeOffset.UtcNow;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return version;
        }
        catch (Exception)
        {
            _logger.LogError("Error publishing version {VersionId}", versionId);
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<PortfolioVersion?> StageVersionAsync(int versionId)
    {
        var version = await _context.PortfolioVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && !v.IsDeleted);

        if (version == null || version.Status == VersionStatus.Published)
        {
            return null;
        }

        version.Status = VersionStatus.Staged;
        await _context.SaveChangesAsync();

        return version;
    }

    public async Task<bool> UnstageVersionAsync(int versionId)
    {
        var version = await _context.PortfolioVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && !v.IsDeleted);

        if (version == null || version.Status != VersionStatus.Staged)
        {
            return false;
        }

        version.Status = VersionStatus.Draft;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<List<PortfolioVersion>> GetStagedVersionsAsync(string portfolioId)
    {
        return await _context.PortfolioVersions
            .Where(v => v.PortfolioId == portfolioId && v.Status == VersionStatus.Staged && !v.IsDeleted)
            .Include(v => v.Creator)
            .OrderByDescending(v => v.VersionNumber)
            .ToListAsync();
    }

    public async Task<bool> SoftDeleteVersionAsync(int versionId)
    {
        var version = await _context.PortfolioVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && !v.IsDeleted);

        if (version == null || version.Status == VersionStatus.Published || version.IsCurrentPublished)
        {
            return false;
        }

        version.IsDeleted = true;
        version.Status = VersionStatus.Archived;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<PortfolioVersion?> CopyVersionAsync(int versionId, Guid userId)
    {
        // Get the source version
        var sourceVersion = await _context.PortfolioVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && !v.IsDeleted);

        if (sourceVersion == null)
        {
            return null;
        }

        // Get portfolio info to create the new version
        var portfolio = await _context.Portfolios
            .FirstOrDefaultAsync(p => p.Id == sourceVersion.PortfolioId);

        if (portfolio == null)
        {
            return null;
        }

        // Create new snapshot from source version's locale snapshot
        var snapshotJson = sourceVersion.LocaleSnapshot;

        // Retry logic to handle concurrent inserts that may cause unique constraint
        // violations on (PortfolioId, VersionNumber). This mirrors CreateVersionAsync.
        const int maxRetries = 3;
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                // Get the next version number (re-read on each attempt)
                var maxVersionNumber = await _context.PortfolioVersions
                    .Where(v => v.PortfolioId == sourceVersion.PortfolioId && !v.IsDeleted)
                    .MaxAsync(v => (int?)v.VersionNumber) ?? 0;

                // Create the new version
                var newVersion = new PortfolioVersion
                {
                    PortfolioId = sourceVersion.PortfolioId,
                    VersionNumber = maxVersionNumber + 1,
                    Status = VersionStatus.Draft,
                    Label = $"Restored from v{sourceVersion.VersionNumber}",
                    ChangeDescription = null,
                    LocaleSnapshot = snapshotJson,
                    CreatedBy = userId,
                    CreatedAt = DateTimeOffset.UtcNow,
                    PublishedAt = null,
                    IsCurrentPublished = false,
                    IsDeleted = false
                };

                _context.PortfolioVersions.Add(newVersion);
                await _context.SaveChangesAsync();

                // Also update live content with the snapshot
                var localeData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(snapshotJson) ?? new();
                foreach (var kvp in localeData)
                {
                    var language = kvp.Key;
                    var contentJson = kvp.Value.GetRawText();
                    var locale = await _context.PortfolioLocales
                        .FirstOrDefaultAsync(l => l.PortfolioId == sourceVersion.PortfolioId && l.Language == language);

                    if (locale != null)
                    {
                        locale.ContentJson = contentJson;
                    }
                    else
                    {
                        _context.PortfolioLocales.Add(new PortfolioLocale
                        {
                            PortfolioId = sourceVersion.PortfolioId,
                            Language = language,
                            ContentJson = contentJson
                        });
                    }
                }
                await _context.SaveChangesAsync();

                return newVersion;
            }
            catch (DbUpdateException ex) when (attempt < maxRetries - 1 && IsUniqueConstraintViolation(ex))
            {
                _logger.LogWarning(ex, "Version number conflict when copying version {VersionId} for portfolio {PortfolioId}, attempt {Attempt}",
                    versionId, sourceVersion.PortfolioId, attempt + 1);

                // Clear tracked entities and retry
                _context.ChangeTracker.Clear();
                await Task.Delay(TimeSpan.FromMilliseconds(50 * (attempt + 1)));
                continue;
            }
        }

        throw new InvalidOperationException($"Failed to copy version {versionId} due to concurrent version-number conflicts after {maxRetries} attempts");
    }

    public async Task<bool> UpdateVersionLocaleAsync(int versionId, string language, string contentJson)
    {
        var version = await _context.PortfolioVersions
            .FirstOrDefaultAsync(v => v.Id == versionId && !v.IsDeleted);

        if (version == null || version.Status == VersionStatus.Published)
        {
            return false; // Cannot update published versions
        }

        // Parse the current snapshot as a dictionary of raw JSON strings
        var snapshot = new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(version.LocaleSnapshot) && version.LocaleSnapshot != "{}")
        {
            using var doc = JsonDocument.Parse(version.LocaleSnapshot);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                snapshot[prop.Name] = prop.Value.GetRawText();
            }
        }

        // If content is blank/empty, remove the language from snapshot
        if (string.IsNullOrWhiteSpace(contentJson) || contentJson == "{}")
        {
            snapshot.Remove(language);
        }
        else
        {
            // Update or add the language content as raw string
            snapshot[language] = contentJson;
        }

        // Rebuild the snapshot JSON preserving field order and formatting
        var snapshotParts = new List<string>();
        foreach (var kvp in snapshot.OrderBy(x => x.Key))
        {
            var escapedLanguage = JsonSerializer.Serialize(kvp.Key);
            snapshotParts.Add($"{escapedLanguage}:{kvp.Value}");
        }

        version.LocaleSnapshot = "{" + string.Join(",", snapshotParts) + "}";
        await _context.SaveChangesAsync();

        return true;
    }

    /// <summary>
    /// Checks if a DbUpdateException is caused by a unique constraint violation
    /// </summary>
    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        // Check for PostgreSQL unique constraint violation error code
        // PostgreSQL error code 23505 = unique_violation
        if (ex.InnerException is Npgsql.PostgresException pgException)
        {
            return pgException.SqlState == "23505";
        }
        
        return false;
    }
}
