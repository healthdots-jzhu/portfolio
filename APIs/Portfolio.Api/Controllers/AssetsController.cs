using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Portfolio.Api.Data;
using Portfolio.Api.Models;
using Portfolio.Api.Services;

namespace Portfolio.Api.Controllers;

[ApiController]
[Route("api/portfolios/{personId}/assets")]
public class AssetsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ICurrentUserProvider _currentUser;
    private readonly IS3Service _s3Service;
    private static readonly string[] AllowedExtensions = { ".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif" };
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5MB

    public AssetsController(AppDbContext context, ICurrentUserProvider currentUser, IS3Service s3Service)
    {
        _context = context;
        _currentUser = currentUser;
        _s3Service = s3Service;
    }

    /// <summary>
    /// Upload an asset to a portfolio.
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public async Task<IActionResult> UploadAsset(string personId, IFormFile file)
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

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "No file uploaded" });
        }

        if (file.Length > MaxFileSizeBytes)
        {
            return BadRequest(new { error = $"File size exceeds {MaxFileSizeBytes / 1024 / 1024}MB limit" });
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
        {
            return BadRequest(new { error = $"File type not allowed. Allowed types: {string.Join(", ", AllowedExtensions)}" });
        }

        string s3Key;
        using (var stream = file.OpenReadStream())
        {
            s3Key = await _s3Service.UploadAssetAsync(portfolio.Id, file.FileName, stream, file.ContentType);
        }

        var cloudFrontUrl = _s3Service.GetCloudFrontUrl(s3Key);

        var asset = new PortfolioAsset
        {
            Id = Guid.NewGuid(),
            PortfolioId = portfolio.Id,
            AssetKey = s3Key,
            S3Url = $"s3://{s3Key}",
            CloudFrontUrl = cloudFrontUrl,
            FileType = extension
        };

        _context.PortfolioAssets.Add(asset);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            asset.Id,
            asset.AssetKey,
            asset.CloudFrontUrl,
            asset.FileType,
            asset.CreatedAt
        });
    }

    /// <summary>
    /// List all assets for a portfolio.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListAssets(string personId)
    {
        var userId = _currentUser.GetUserId(HttpContext);
        if (userId == Guid.Empty)
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        var portfolio = await _context.Portfolios
            .Include(p => p.Assets)
            .Where(p => p.PersonId == personId && p.OwnerId == userId)
            .FirstOrDefaultAsync();

        if (portfolio == null)
        {
            return NotFound(new { error = "Portfolio not found or access denied" });
        }

        var assets = portfolio.Assets.Select(a => new
        {
            a.Id,
            a.AssetKey,
            a.CloudFrontUrl,
            a.FileType,
            a.CreatedAt
        });

        return Ok(assets);
    }
}
