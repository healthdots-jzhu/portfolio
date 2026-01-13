using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Portfolio.Api.Models;

public class PortfolioLocale
{
    public Guid Id { get; set; }

    [MaxLength(6)]
    public string PortfolioId { get; set; } = string.Empty;

    [ForeignKey(nameof(PortfolioId))]
    public Portfolio Portfolio { get; set; } = default!;

    [MaxLength(10)]
    public string Language { get; set; } = "en";

    // Stored as JSONB in PostgreSQL
    public string ContentJson { get; set; } = "{}";

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
