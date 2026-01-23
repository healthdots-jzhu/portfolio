using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Portfolio.Api.Services
{
    public class GitHubModelsRetryHandler : DelegatingHandler
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<GitHubModelsRetryHandler> _logger;

        public GitHubModelsRetryHandler(IConfiguration configuration, ILogger<GitHubModelsRetryHandler> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var retrySection = _configuration.GetSection("GitHubModels:Retry");
            var maxAttempts = retrySection.GetValue<int?>("MaxAttempts") ?? 3;
            var initialDelayMs = retrySection.GetValue<int?>("InitialDelayMs") ?? 200;

            int attempt = 0;
            Exception? lastEx = null;

            while (true)
            {
                attempt++;
                try
                {
                    var resp = await base.SendAsync(request, cancellationToken).ConfigureAwait(false);

                    // For 5xx errors retry
                    if ((int)resp.StatusCode >= 500 && attempt < maxAttempts)
                    {
                        _logger.LogWarning("GitHubModels HTTP {Method} {Uri} returned {Status} (attempt {Attempt}/{Max}) - retrying", request.Method, request.RequestUri, resp.StatusCode, attempt, maxAttempts);
                        var delay = TimeSpan.FromMilliseconds(initialDelayMs * Math.Pow(2, attempt - 1));
                        await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
                        continue;
                    }

                    return resp;
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    lastEx = ex;
                    _logger.LogWarning(ex, "GitHubModels request failed (attempt {Attempt}/{Max})", attempt, maxAttempts);
                    if (attempt >= maxAttempts)
                    {
                        throw;
                    }
                    var delay = TimeSpan.FromMilliseconds(initialDelayMs * Math.Pow(2, attempt - 1));
                    try { await Task.Delay(delay, cancellationToken).ConfigureAwait(false); } catch { throw; }
                }
            }
        }
    }
}
