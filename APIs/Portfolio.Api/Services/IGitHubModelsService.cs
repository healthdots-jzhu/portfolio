using System.Threading;
using System.Threading.Tasks;

namespace Portfolio.Api.Services
{
    public class GitHubModelOptions
    {
        public int? MaxTokens { get; set; }
        public double? Temperature { get; set; }
    }

    public interface IGitHubModelsService
    {
        /// <summary>
        /// Generates a JSON string representing locale content from a prompt.
        /// </summary>
        Task<string> GenerateLocaleJsonAsync(string prompt, string language, GitHubModelOptions? options = null, CancellationToken ct = default);
    }
}
