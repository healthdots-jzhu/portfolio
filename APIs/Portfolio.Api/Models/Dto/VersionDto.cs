using System.ComponentModel.DataAnnotations;

namespace Portfolio.Api.Models.Dto;

public class CreateVersionRequest
{
    [MaxLength(200)]
    public string? Label { get; set; }

    [MaxLength(2000)]
    public string? ChangeDescription { get; set; }

    /// <summary>
    /// Whether to immediately stage this version for preview
    /// </summary>
    public bool Stage { get; set; } = false;
}

public class UpdateVersionRequest
{
    [MaxLength(200)]
    public string? Label { get; set; }

    [MaxLength(2000)]
    public string? ChangeDescription { get; set; }
}

public class PublishVersionRequest
{
    /// <summary>
    /// Confirmation that the user wants to publish
    /// </summary>
    [Required]
    public bool Confirmed { get; set; }
}

public class StageVersionRequest
{
    [Required]
    public Guid VersionId { get; set; }
}

public class ValidateLocaleRequest
{
    [Required]
    public string ContentJson { get; set; } = "{}";

    [Required, MaxLength(10)]
    public string Language { get; set; } = "en";
}

public class ValidateLocaleResponse
{
    public bool IsValid { get; set; }
    public List<ValidationError> Errors { get; set; } = new();
    public List<ValidationWarning> Warnings { get; set; } = new();
}

public class ValidationError
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Severity { get; set; } = "Error";
}

public class ValidationWarning
{
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class VersionSummary
{
    public int Id { get; set; }
    public int VersionNumber { get; set; }
    public VersionStatus Status { get; set; }
    public string? Label { get; set; }
    public string? ChangeDescription { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public bool IsCurrentPublished { get; set; }
    public string CreatorName { get; set; } = string.Empty;
}

public class VersionDetail
{
    public int Id { get; set; }
    public int VersionNumber { get; set; }
    public VersionStatus Status { get; set; }
    public string? Label { get; set; }
    public string? ChangeDescription { get; set; }
    public Dictionary<string, object> LocaleContent { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public bool IsCurrentPublished { get; set; }
    public string CreatorName { get; set; } = string.Empty;
}
