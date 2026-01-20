using Amazon.S3;
using Amazon.S3.Model;

namespace Portfolio.Api.Services;

public interface IS3Service
{
    Task<string> UploadAssetAsync(string portfolioId, string fileName, Stream fileStream, string contentType);
    string GetCloudFrontUrl(string s3Key);
    string GetS3Uri(string s3Key);
}

public class S3Service : IS3Service
{
    private readonly IAmazonS3 _s3Client;
    private readonly IConfiguration _configuration;
    private readonly string _bucketName;
    private readonly string _cloudFrontDomain;
    private readonly ILogger<S3Service> _logger;

    public S3Service(IAmazonS3 s3Client, IConfiguration configuration, ILogger<S3Service> logger)
    {
        _s3Client = s3Client;
        _configuration = configuration;
        _bucketName = configuration["Aws:S3:BucketName"] ?? "healthdots-portfolio-web-app-001";
        _cloudFrontDomain = configuration["Aws:CloudFront:Domain"] ?? "";
        _logger = logger;
    }

    public async Task<string> UploadAssetAsync(string portfolioId, string fileName, Stream fileStream, string contentType)
    {
        var sanitizedFileName = SanitizeFileName(fileName);
        var s3Key = $"img/{SanitizePathSegment(portfolioId)}/{sanitizedFileName}";

        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = s3Key,
            InputStream = fileStream,
            ContentType = contentType,
            CannedACL = S3CannedACL.Private
        };

        await _s3Client.PutObjectAsync(request);

        return s3Key;
    }

    public string GetCloudFrontUrl(string s3Key)
    {
        if (string.IsNullOrEmpty(_cloudFrontDomain))
        {
            return $"https://{_bucketName}.s3.amazonaws.com/{s3Key}";
        }

        return $"https://{_cloudFrontDomain}/{s3Key}";
    }

    public string GetS3Uri(string s3Key)
    {
        return $"s3://{_bucketName}/{s3Key}";
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalidChars = Path.GetInvalidFileNameChars();
        return string.Join("_", fileName.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries));
    }

    private static string SanitizePathSegment(string segment)
    {
        var invalidChars = Path.GetInvalidPathChars();
        // Also remove slash characters to prevent breaking the key structure
        return string.Join("_", segment.Replace('/', '_').Replace('\\', '_').Split(invalidChars, StringSplitOptions.RemoveEmptyEntries));
    }
}
