using System;
using System.Threading;
using System.Threading.Tasks;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Portfolio.Api.Services
{
    public interface IGitHubModelsTokenProvider
    {
        Task<(string? Token, string Source)> GetTokenAsync(CancellationToken ct = default);
    }

    public class GitHubModelsTokenProvider : IGitHubModelsTokenProvider
    {
        private readonly IConfiguration _config;
        private readonly ILogger<GitHubModelsTokenProvider> _logger;
        private readonly IAmazonSimpleSystemsManagement? _ssm;
        private readonly IMemoryCache _cache;
        private readonly TimeSpan _cacheDuration;

        private const string CacheKey = "GitHubModels:ApiToken";

        public GitHubModelsTokenProvider(IConfiguration config, ILogger<GitHubModelsTokenProvider> logger, IMemoryCache cache, IAmazonSimpleSystemsManagement? ssm = null)
        {
            _config = config;
            _logger = logger;
            _ssm = ssm;
            _cache = cache;
            var minutes = _config.GetValue<int?>("GitHubModels:TokenCacheMinutes") ?? 60;
            _cacheDuration = TimeSpan.FromMinutes(minutes);
        }

        public async Task<(string? Token, string Source)> GetTokenAsync(CancellationToken ct = default)
        {
            if (_cache.TryGetValue(CacheKey, out (string Token, string Source) cached) && !string.IsNullOrEmpty(cached.Token))
            {
                return (cached.Token, cached.Source);
            }

            string? token = null;
            string source = "(none)";

            // 1) environment variable
            token = Environment.GetEnvironmentVariable("GitHubModels__ApiToken");
            if (!string.IsNullOrWhiteSpace(token)) source = "env:GitHubModels__ApiToken";

            // 2) appsettings
            if (string.IsNullOrWhiteSpace(token))
            {
                token = _config["GitHubModels:ApiToken"];
                if (!string.IsNullOrWhiteSpace(token)) source = "appsettings:GitHubModels:ApiToken";
            }

            // 3) SSM Parameter Store
            if (string.IsNullOrWhiteSpace(token))
            {
                var paramName = _config["GitHubModels:ApiTokenParameterName"];
                if (!string.IsNullOrWhiteSpace(paramName) && _ssm is not null)
                {
                    try
                    {
                        var resp = await _ssm.GetParameterAsync(new GetParameterRequest { Name = paramName, WithDecryption = true }, ct);
                        token = resp.Parameter?.Value;
                        if (!string.IsNullOrWhiteSpace(token)) source = $"ssm:{paramName}";
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to load GitHub Models API token from SSM parameter {Param}", paramName);
                    }
                }
            }

            // Cache result (even empty) to avoid hot loops; empty token treated as not configured.
            _cache.Set(CacheKey, (token ?? string.Empty, source), new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = _cacheDuration });

            return (token, source);
        }
    }
}
