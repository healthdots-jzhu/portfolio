using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Portfolio.Api.Models;

public class User
{
    public Guid Id { get; set; }

    [MaxLength(100)]
    public string Subject { get; set; } = string.Empty;

    [MaxLength(255)]
    public string Issuer { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Provider { get; set; } = string.Empty;

    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    public DateTimeOffset LastLoginAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Portfolio> Portfolios { get; set; } = new List<Portfolio>();
}
