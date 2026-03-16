using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Portfolio.Api.Data;

namespace Portfolio.Api.Utils
{
    public static class CacheInvalidationHelper
    {
        /// <summary>
        /// Build a list of cache keys for a portfolio (personId and personId#lang) and enqueue invalidation.
        /// Exceptions are caught and logged; callers may fire-and-forget this task.
        /// </summary>
        public static async Task EnqueueInvalidateKeysForPortfolioAsync(Services.IDynamoCacheService cacheService, AppDbContext db, string? tableName, string personId, string portfolioId, ILogger? logger = null, IEnumerable<string>? explicitKeys = null)
        {
            if (cacheService == null || db == null || string.IsNullOrWhiteSpace(tableName) || string.IsNullOrWhiteSpace(personId) || string.IsNullOrWhiteSpace(portfolioId))
            {
                return;
            }

            try
            {
                var languages = await db.PortfolioLocales
                    .Where(l => l.PortfolioId == portfolioId)
                    .Select(l => l.Language)
                    .ToListAsync();

                var keys = new HashSet<string>(StringComparer.Ordinal);
                keys.Add(personId);
                foreach (var lang in languages.Where(l => !string.IsNullOrWhiteSpace(l)))
                {
                    keys.Add($"{personId}#{lang}");
                }

                if (explicitKeys != null)
                {
                    foreach (var ek in explicitKeys.Where(k => !string.IsNullOrWhiteSpace(k))) keys.Add(ek!);
                }

                if (keys.Count == 0) return;

                // Fire-and-forget the actual invalidation call; the cache service handles batching/retries.
                _ = cacheService.InvalidateKeysAsync(keys, tableName);
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "Failed to enqueue cache invalidation for person {PersonId}", personId);
            }
        }
    }
}
