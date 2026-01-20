using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Portfolio.Api.Models;

public class PortfolioAsset
{
    public Guid Id { get; set; }

    [MaxLength(6)]
    public string PortfolioId { get; set; } = string.Empty;

    [ForeignKey(nameof(PortfolioId))]
    public Portfolio Portfolio { get; set; } = default!;

    [MaxLength(255)]
    public string AssetKey { get; set; } = string.Empty;

    [MaxLength(50)]
    public string FileType { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
