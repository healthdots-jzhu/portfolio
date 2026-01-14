using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Portfolio.Api.Models;

public class Portfolio
{
    /// <summary>
    /// 6-character obfuscated ID (e.g., "EU2OPK"). Derived from SequentialId via Hashids.
    /// </summary>
    [MaxLength(6)]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Sequential database ID used to generate the short Id.
    /// Auto-increment primary key in database.
    /// </summary>
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long SequentialId { get; set; }

    [MaxLength(120)]
    public string PersonId { get; set; } = string.Empty;

    [MaxLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    [MaxLength(120)]
    public string? Subdomain { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Guid OwnerId { get; set; }

    [ForeignKey(nameof(OwnerId))]
    public User Owner { get; set; } = default!;

    public ICollection<PortfolioLocale> Locales { get; set; } = new List<PortfolioLocale>();

    public ICollection<PortfolioAsset> Assets { get; set; } = new List<PortfolioAsset>();
}
