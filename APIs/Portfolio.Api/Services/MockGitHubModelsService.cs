using System.Text.Json;

namespace Portfolio.Api.Services;

/// <summary>
/// Mock implementation of IGitHubModelsService for local development.
/// Returns predefined mock content for testing without requiring GitHub Models API calls.
/// </summary>
public class MockGitHubModelsService : IGitHubModelsService
{
    private readonly ILogger<MockGitHubModelsService> _logger;

    public MockGitHubModelsService(ILogger<MockGitHubModelsService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Generate mock locale JSON content for portfolio.
    /// Returns consistent mock data for each language to enable testing without API calls.
    /// </summary>
    public async Task<string> GenerateLocaleJsonAsync(
        string prompt,
        string language,
        GitHubModelOptions? options = null,
        CancellationToken ct = default)
    {
        _logger.LogInformation("Mock GitHub Models: Generating {Language} content", language);

        // Simulate async operation
        await Task.Delay(100, ct);

        var summary = language switch
        {
            "fr" => "Résumé du portfolio généré localement pour les tests.",
            "es" => "Resumen del portafolio generado localmente para pruebas.",
            "de" => "Lokal generierte Portfolio-Zusammenfassung für Tests.",
            "ja" => "ローカルで生成されたテスト用ポートフォリオサマリー。",
            _ => "Mock portfolio summary generated locally for testing."
        };

        var highlights = language switch
        {
            "fr" => new[] { "Compétence démontrée 1", "Compétence démontrée 2", "Compétence démontrée 3" },
            "es" => new[] { "Habilidad demostrada 1", "Habilidad demostrada 2", "Habilidad demostrada 3" },
            "de" => new[] { "Nachgewiesene Fähigkeit 1", "Nachgewiesene Fähigkeit 2", "Nachgewiesene Fähigkeit 3" },
            "ja" => new[] { "実証済みスキル1", "実証済みスキル2", "実証済みスキル3" },
            _ => new[] { "Demonstrated skill 1", "Demonstrated skill 2", "Demonstrated skill 3" }
        };

        var mockResponse = new
        {
            summary,
            highlights,
            generated = DateTime.UtcNow,
            environment = "local-mock"
        };

        return JsonSerializer.Serialize(mockResponse);
    }
}
