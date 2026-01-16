using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Models;
using Portfolio.Api.Services;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PortfoliosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ICurrentUserProvider _currentUser;
    private readonly IShortIdGenerator _shortIdGenerator;

    public PortfoliosController(AppDbContext context, ICurrentUserProvider currentUser, IShortIdGenerator shortIdGenerator)
    {
        _context = context;
        _currentUser = currentUser;
        _shortIdGenerator = shortIdGenerator;
    }

    /// <summary>
    /// Get portfolios owned by the authenticated user (or all if admin).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPortfolios()
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolios = await _context.Portfolios
            .Where(p => p.OwnerId == userId && p.IsActive)
            .Select(p => new
            {
                p.Id,
                p.PersonId,
                p.DisplayName,
                p.Subdomain,
                p.IsActive,
                p.CreatedAt,
                p.UpdatedAt,
                LocaleCount = p.Locales.Count,
                AssetCount = p.Assets.Count
            })
            .ToListAsync();

        return Ok(portfolios);
    }

    /// <summary>
    /// Get public portfolio metadata by personId.
    /// </summary>
    [HttpGet("{personId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPortfolio(string personId)
    {
        var portfolio = await _context.Portfolios
            .Include(p => p.Locales)
            .Where(p => p.PersonId == personId && p.IsActive)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found" });
        }

        var availableLanguages = portfolio.Locales
            .Select(l => l.Language)
            .Distinct()
            .OrderBy(l => l)
            .ToList();

        return Ok(new
        {
            portfolio.Id,
            portfolio.PersonId,
            portfolio.DisplayName,
            portfolio.Subdomain,
            portfolio.CreatedAt,
            AvailableLanguages = availableLanguages
        });
    }

    /// <summary>
    /// Get locale content for a portfolio by personId and language.
    /// </summary>
    [HttpGet("{personId}/locales/{language}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLocale(string personId, string language)
    {
        var locale = await _context.PortfolioLocales
            .Include(l => l.Portfolio)
            .Where(l => l.Portfolio.PersonId == personId && l.Portfolio.IsActive && l.Language == language)
            .FirstOrDefaultAsync();

        if (locale == null)
        {
            return NotFound(new { error = "Locale not found" });
        }

        return Content(locale.ContentJson, "application/json");
    }

    /// <summary>
    /// Soft-delete a portfolio (sets IsActive = false).
    /// </summary>
    [HttpDelete("{personId}")]
    public async Task<IActionResult> DeletePortfolio(string personId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Where(p => p.PersonId == personId && p.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        portfolio.IsActive = false;
        portfolio.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Portfolio deactivated successfully" });
    }

    /// <summary>
    /// Create a new portfolio for the authenticated user.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreatePortfolio([FromBody] Portfolio.Api.Models.Dto.CreatePortfolioRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        // Generate personId if not provided
        var personId = request.PreferredPersonId ?? $"portfolio-{Guid.NewGuid().ToString("N")[..8]}";

        // Check if personId already exists
        if (await _context.Portfolios.AnyAsync(p => p.PersonId == personId))
        {
            return BadRequest(new { error = "PersonId already exists" });
        }

        // Atomically fetch next sequence value from database to avoid races
        var nextSequentialId = await GetNextSequentialIdAsync();
        var shortId = _shortIdGenerator.Encode(nextSequentialId);

        var portfolio = new Portfolio.Api.Models.Portfolio
        {
            Id = shortId,
            SequentialId = nextSequentialId,
            PersonId = personId,
            DisplayName = request.DisplayName,
            Subdomain = request.Subdomain,
            OwnerId = userId,
            IsActive = true
        };

        _context.Portfolios.Add(portfolio);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPortfolio), new { personId = portfolio.PersonId }, new
        {
            Id = shortId,
            portfolio.PersonId,
            portfolio.DisplayName,
            portfolio.Subdomain,
            portfolio.IsActive
        });
    }

    // Fetch next sequence value from PostgreSQL for Portfolios.SequentialId to avoid race conditions.
    private async Task<long> GetNextSequentialIdAsync()
    {
        var connection = _context.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;

        if (shouldClose)
        {
            await connection.OpenAsync();
        }

        await using var command = connection.CreateCommand();
        command.CommandText = @"SELECT nextval(pg_get_serial_sequence('""Portfolios""', 'SequentialId'))";

        var result = await command.ExecuteScalarAsync();

        if (shouldClose)
        {
            await connection.CloseAsync();
        }

        return Convert.ToInt64(result);
    }

    /// <summary>
    /// Update portfolio metadata.
    /// </summary>
    [HttpPut("{personId}")]
    public async Task<IActionResult> UpdatePortfolio(string personId, [FromBody] Portfolio.Api.Models.Dto.UpdatePortfolioRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Where(p => p.PersonId == personId && p.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        if (request.DisplayName != null) portfolio.DisplayName = request.DisplayName;
        if (request.Subdomain != null) portfolio.Subdomain = request.Subdomain;
        if (request.IsActive.HasValue) portfolio.IsActive = request.IsActive.Value;

        portfolio.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            portfolio.Id,
            portfolio.PersonId,
            portfolio.DisplayName,
            portfolio.Subdomain,
            portfolio.IsActive,
            portfolio.UpdatedAt
        });
    }

    /// <summary>
    /// Update or create locale content for a portfolio.
    /// </summary>
    [HttpPut("{personId}/locales/{language}")]
    public async Task<IActionResult> UpdateLocale(string personId, string language, [FromBody] Portfolio.Api.Models.Dto.UpdateLocaleRequest request)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Include(p => p.Locales)
            .Where(p => p.PersonId == personId && p.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        var locale = await _context.PortfolioLocales
            .Where(l => l.PortfolioId == portfolio.Id && l.Language == language)
            .FirstOrDefaultAsync();

        if (locale == null)
        {
            locale = new PortfolioLocale
            {
                Id = Guid.NewGuid(),
                PortfolioId = portfolio.Id,
                Language = language,
                ContentJson = request.ContentJson
            };
            _context.PortfolioLocales.Add(locale);
        }
        else
        {
            locale.ContentJson = request.ContentJson;
            locale.UpdatedAt = DateTimeOffset.UtcNow;
        }

        portfolio.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Locale updated successfully", language, updatedAt = locale.UpdatedAt });
    }
}
