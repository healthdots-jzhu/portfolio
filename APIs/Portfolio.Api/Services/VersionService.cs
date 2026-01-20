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

        // Create snapshot
        var snapshot = new Dictionary<string, object>();
        foreach (var locale in locales)
        {
            try
            {
                var content = JsonSerializer.Deserialize<Dictionary<string, object>>(locale.ContentJson);
                snapshot[locale.Language] = content ?? new Dictionary<string, object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deserializing locale content for {Language}", locale.Language);
                snapshot[locale.Language] = new Dictionary<string, object>();
            }
        }

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
                    LocaleSnapshot = JsonSerializer.Serialize(snapshot),
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
            .FirstOrDefaultAsync(v => v.Id == versionId);
    }

    public async Task<List<VersionSummary>> GetVersionHistoryAsync(string portfolioId)
    {
        return await _context.PortfolioVersions
            .Where(v => v.PortfolioId == portfolioId)
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
            .Where(v => v.PortfolioId == portfolioId && v.IsCurrentPublished)
            .FirstOrDefaultAsync();
    }

    public async Task<PortfolioVersion?> PublishVersionAsync(int versionId, Guid userId)
    {
        var version = await _context.PortfolioVersions
            .Include(v => v.Portfolio)
            .FirstOrDefaultAsync(v => v.Id == versionId);

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
                .Where(v => v.PortfolioId == version.PortfolioId && v.IsCurrentPublished)
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error publishing version {VersionId}", versionId);
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<PortfolioVersion?> StageVersionAsync(int versionId)
    {
        var version = await _context.PortfolioVersions
            .FirstOrDefaultAsync(v => v.Id == versionId);

        if (version == null)
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
            .FirstOrDefaultAsync(v => v.Id == versionId);

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
            .Where(v => v.PortfolioId == portfolioId && v.Status == VersionStatus.Staged)
            .Include(v => v.Creator)
            .OrderByDescending(v => v.VersionNumber)
            .ToListAsync();
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
