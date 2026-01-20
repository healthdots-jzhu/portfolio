using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Portfolio.Api.Models;

/// <summary>
/// Status of a portfolio version
/// </summary>
public enum VersionStatus
{
    Draft = 0,
    Staged = 1,
    Published = 2,
    Archived = 3
}

/// <summary>
/// Represents a version of a portfolio with all its locale content at a specific point in time.
/// Supports versioning, staging, and history tracking.
/// </summary>
[Index(nameof(PortfolioId), nameof(VersionNumber), IsUnique = true, Name = "IX_PortfolioVersions_PortfolioId_VersionNumber")]
public class PortfolioVersion
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [MaxLength(6)]
    public string PortfolioId { get; set; } = string.Empty;

    [ForeignKey(nameof(PortfolioId))]
    public Portfolio Portfolio { get; set; } = default!;

    /// <summary>
    /// Version number, auto-incremented per portfolio.
    /// </summary>
    public int VersionNumber { get; set; }

    /// <summary>
    /// Status of this version: Draft, Staged, Published, Archived
    /// </summary>
    public VersionStatus Status { get; set; } = VersionStatus.Draft;

    /// <summary>
    /// Optional label for this version (e.g., "Winter Update 2026", "Fix typos")
    /// </summary>
    [MaxLength(200)]
    public string? Label { get; set; }

    /// <summary>
    /// Description of changes in this version
    /// </summary>
    [MaxLength(2000)]
    public string? ChangeDescription { get; set; }

    /// <summary>
    /// Snapshot of all locale content at this version (stored as JSON)
    /// Structure: { "en": { ...content }, "fr": { ...content }, ... }
    /// </summary>
    public string LocaleSnapshot { get; set; } = "{}";

    /// <summary>
    /// User who created this version
    /// </summary>
    public Guid CreatedBy { get; set; }

    [ForeignKey(nameof(CreatedBy))]
    public User Creator { get; set; } = default!;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// When this version was published (null if not published yet)
    /// </summary>
    public DateTimeOffset? PublishedAt { get; set; }

    /// <summary>
    /// User who published this version
    /// </summary>
    public Guid? PublishedBy { get; set; }

    /// <summary>
    /// Indicates if this is the currently published version
    /// </summary>
    public bool IsCurrentPublished { get; set; } = false;

    /// <summary>
    /// Soft-delete flag for unpublished versions
    /// </summary>
    public bool IsDeleted { get; set; } = false;
}
