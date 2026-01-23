using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Portfolio.Api.Services
{
    public class ModelGenerationException : Exception
    {
        public ModelGenerationException(string message) : base(message) { }
        public ModelGenerationException(string message, Exception inner) : base(message, inner) { }
    }

    public class GitHubModelsService : IGitHubModelsService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GitHubModelsService> _logger;
        private readonly IAmazonSimpleSystemsManagement? _ssm;

        public GitHubModelsService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<GitHubModelsService> logger, IAmazonSimpleSystemsManagement? ssm = null)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
            _ssm = ssm;
        }

        public async Task<string> GenerateLocaleJsonAsync(string prompt, string language, GitHubModelOptions? options = null, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(prompt)) throw new ArgumentException("Prompt is required", nameof(prompt));

            var baseUrl = _configuration["GitHubModels:BaseUrl"] ?? string.Empty;
            var model = _configuration["GitHubModels:Model"] ?? "gpt-4o-mini";
            var maxResponseSize = _configuration.GetValue<int?>("GitHubModels:MaxResponseSizeBytes") ?? 200_000;

            // Resolve token: prefer environment variable, then appsettings, then SSM parameter
            string? token = null;
            string tokenSource = "(none)";

            // 1) environment variable (supporting ASP.NET config double-underscore naming)
            token = Environment.GetEnvironmentVariable("GitHubModels__ApiToken");
            if (!string.IsNullOrWhiteSpace(token)) tokenSource = "env:GitHubModels__ApiToken";

            // 2) appsettings.json
            if (string.IsNullOrWhiteSpace(token))
            {
                token = _configuration["GitHubModels:ApiToken"];
                if (!string.IsNullOrWhiteSpace(token)) tokenSource = "appsettings:GitHubModels:ApiToken";
            }

            // 3) SSM Parameter Store
            if (string.IsNullOrWhiteSpace(token))
            {
                var paramName = _configuration["GitHubModels:ApiTokenParameterName"];
                if (!string.IsNullOrWhiteSpace(paramName) && _ssm is not null)
                {
                    try
                    {
                        var resp = await _ssm.GetParameterAsync(new GetParameterRequest { Name = paramName, WithDecryption = true }, ct);
                        token = resp.Parameter?.Value;
                        if (!string.IsNullOrWhiteSpace(token)) tokenSource = $"ssm:{paramName}";
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to load GitHub Models API token from SSM parameter {Param}", paramName);
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(token))
            {
                _logger.LogError("GitHub Models API token is not configured (no env/appsettings/ssm value)");
                throw new ModelGenerationException("GitHub Models API token is not configured");
            }

            _logger.LogDebug("Using GitHub Models token from {Source}", tokenSource);

            var client = _httpClientFactory.CreateClient("GitHubModels");

            // Decide endpoint and payload shape based on configured BaseUrl.
            var requestPath = "v1/responses";
            object payload;

            // Build a strict instruction asking for pure JSON object output.
            var instruction = $"You are a JSON generator. Produce a single JSON object, no surrounding text. The object must be valid JSON and represent the locale content for language '{language}'. Respond only with JSON.";

            if (!string.IsNullOrWhiteSpace(baseUrl) && baseUrl.Contains("models.github.ai", StringComparison.OrdinalIgnoreCase))
            {
                // models.github.ai expects a chat/completions-like payload with messages
                requestPath = "inference/chat/completions";
                payload = new
                {
                    model = model,
                    messages = new[] {
                        new { role = "system", content = instruction },
                        new { role = "user", content = prompt }
                    },
                    temperature = options?.Temperature,
                    max_tokens = options?.MaxTokens
                };

                // Ensure Accept header is standard JSON for this host (named client already set a default; override if needed)
                try { client.DefaultRequestHeaders.Accept.Clear(); client.DefaultRequestHeaders.Accept.ParseAdd("application/json"); } catch { }
            }
            else
            {
                // Default to GitHub Responses API shape
                requestPath = "v1/responses";
                payload = new
                {
                    model = model,
                    input = new
                    {
                        prompt = instruction + "\n\n" + prompt,
                        language = language,
                        max_tokens = options?.MaxTokens,
                        temperature = options?.Temperature
                    }
                };
                var apiVersion = _configuration["GitHubModels:ApiVersion"]; 
                if (!string.IsNullOrWhiteSpace(apiVersion))
                {
                    // will be added to request below
                }
            }

            using var req = new HttpRequestMessage(HttpMethod.Post, requestPath);
            // Add Authorization per-request (token may be sourced from SSM or env)
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            // GitHub Responses API version header (if present in config)
            var apiVersionHeader = _configuration["GitHubModels:ApiVersion"]; 
            if (!string.IsNullOrWhiteSpace(apiVersionHeader) && requestPath.StartsWith("v1/responses", StringComparison.OrdinalIgnoreCase)) req.Headers.Add("X-GitHub-Api-Version", apiVersionHeader);

            // Add a correlation id for tracing
            var correlationId = System.Diagnostics.Activity.Current?.Id ?? Guid.NewGuid().ToString();
            if (!req.Headers.Contains("X-Request-Id")) req.Headers.Add("X-Request-Id", correlationId);

            var json = JsonSerializer.Serialize(payload);
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                using var resp = await client.SendAsync(req, HttpCompletionOption.ResponseContentRead, ct);
                var respText = await resp.Content.ReadAsStringAsync(ct);

                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("GitHub Models API returned {Status}: {Body}", resp.StatusCode, Truncate(respText, 2000));
                    if (resp.StatusCode == System.Net.HttpStatusCode.Forbidden)
                    {
                        throw new ModelGenerationException("Model API returned Forbidden - check GitHub token and permissions");
                    }
                    throw new ModelGenerationException($"Model API returned {resp.StatusCode}");
                }

                if (string.IsNullOrWhiteSpace(respText))
                {
                    throw new ModelGenerationException("Model returned empty response");
                }

                if (respText.Length > maxResponseSize)
                {
                    throw new ModelGenerationException("Model response exceeds allowed size");
                }

                // Parse the wrapper response and attempt to extract the assistant content
                string? assistantText = null;
                try
                {
                    using var doc = JsonDocument.Parse(respText);
                    var root = doc.RootElement;

                    // Common shapes:
                    // 1) top-level "generated" (string) which may itself be JSON
                    if (root.TryGetProperty("generated", out var gen) && gen.ValueKind == JsonValueKind.String)
                    {
                        var genStr = gen.GetString();
                        if (!string.IsNullOrWhiteSpace(genStr))
                        {
                            // Try parse the generated string as JSON - it may itself be a wrapper
                            try
                            {
                                using var inner = JsonDocument.Parse(genStr);
                                var innerRoot = inner.RootElement;
                                // If inner contains choices/message, extract from there
                                if (innerRoot.TryGetProperty("choices", out var innerChoices) && innerChoices.ValueKind == JsonValueKind.Array && innerChoices.GetArrayLength() > 0)
                                {
                                    var first = innerChoices[0];
                                    if (first.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.String)
                                    {
                                        assistantText = content.GetString();
                                    }
                                    else if (first.TryGetProperty("content", out var content2) && content2.ValueKind == JsonValueKind.String)
                                    {
                                        assistantText = content2.GetString();
                                    }
                                }
                                else
                                {
                                    // innerRoot may already be the locale JSON
                                    assistantText = genStr;
                                }
                            }
                            catch (JsonException)
                            {
                                // generated string is not JSON; treat it as assistant text
                                assistantText = genStr;
                            }
                        }
                    }

                    // 2) choices array at root (chat/completions style)
                    if (assistantText == null && root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
                    {
                        var first = choices[0];
                        if (first.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.String)
                        {
                            assistantText = content.GetString();
                        }
                        else if (first.TryGetProperty("content", out var content2) && content2.ValueKind == JsonValueKind.String)
                        {
                            assistantText = content2.GetString();
                        }
                    }

                    // 3) common alt keys
                    if (assistantText == null)
                    {
                        foreach (var key in new[] { "output", "result", "text" })
                        {
                            if (root.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String)
                            {
                                assistantText = v.GetString();
                                break;
                            }
                        }
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Failed parsing model wrapper response: {Snippet}", Truncate(respText, 600));
                    throw new ModelGenerationException("Model wrapper response is not valid JSON", ex);
                }

                if (string.IsNullOrWhiteSpace(assistantText))
                {
                    // As a last resort try to extract a JSON object substring from the response
                    var firstBrace = respText.IndexOf('{');
                    var lastBrace = respText.LastIndexOf('}');
                    if (firstBrace >= 0 && lastBrace > firstBrace)
                    {
                        var sub = respText.Substring(firstBrace, lastBrace - firstBrace + 1);
                        assistantText = sub;
                    }
                }

                if (string.IsNullOrWhiteSpace(assistantText))
                {
                    _logger.LogWarning("No assistant content could be extracted from model response: {Snippet}", Truncate(respText, 600));
                    throw new ModelGenerationException("No assistant content found in model response");
                }

                if (assistantText.Length > maxResponseSize)
                {
                    throw new ModelGenerationException("Assistant content exceeds allowed size");
                }

                // Attempt to parse assistantText as JSON (the desired locale object)
                try
                {
                    using var localeDoc = JsonDocument.Parse(assistantText);
                    if (localeDoc.RootElement.ValueKind != JsonValueKind.Object && localeDoc.RootElement.ValueKind != JsonValueKind.Array)
                    {
                        throw new ModelGenerationException("Assistant content is not a JSON object or array");
                    }

                    var localeJson = localeDoc.RootElement.GetRawText();
                    return localeJson;
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Assistant content is not valid JSON: {Snippet}", Truncate(assistantText, 600));
                    throw new ModelGenerationException("Assistant content was not valid JSON", ex);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex) when (!(ex is ModelGenerationException))
            {
                _logger.LogError(ex, "Model generation failed");
                throw new ModelGenerationException("Model generation failed", ex);
            }
        }

        private static string Truncate(string s, int max)
        {
            if (s == null) return string.Empty;
            return s.Length <= max ? s : s.Substring(0, max) + "...";
        }
    }
}
