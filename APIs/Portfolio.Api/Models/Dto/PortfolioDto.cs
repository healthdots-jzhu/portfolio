using System.ComponentModel.DataAnnotations;

namespace Portfolio.Api.Models.Dto;

public class CreatePortfolioRequest
{
    [Required, MaxLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    [MaxLength(120)]
    public string? PreferredPersonId { get; set; }

    [MaxLength(120)]
    public string? Subdomain { get; set; }
}

public class UpdatePortfolioRequest
{
    [MaxLength(200)]
    public string? DisplayName { get; set; }

    [MaxLength(120)]
    public string? Subdomain { get; set; }

    public bool? IsActive { get; set; }
}

public class UpdateLocaleRequest
{
    [Required]
    public string ContentJson { get; set; } = "{}";
}
