using Amazon.S3;
using Amazon.S3.Model;

namespace Portfolio.Api.Services;

public interface IS3Service
{
    Task<string> UploadAssetAsync(string portfolioId, string fileName, Stream fileStream, string contentType);
    string GetCloudFrontUrl(string s3Key);
    string GetS3Uri(string s3Key);
    Task<bool> AssetExistsAsync(string s3Key);
    Task DeleteObjectAsync(string s3Key);
}

public class S3Service : IS3Service
{
    public async Task<bool> AssetExistsAsync(string s3Key)
    {
        try
        {
            var request = new GetObjectMetadataRequest
            {
                BucketName = _bucketName,
                Key = s3Key
            };
            var response = await _s3Client.GetObjectMetadataAsync(request);
            return true;
        }
        catch (AmazonS3Exception ex)
        {
            // If object not found, return false.
            if (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                return false;

            // S3 returns 403 Forbidden instead of 404 for non-existent keys in some bucket-policy
            // configurations (e.g. when ListBucket is restricted by an org SCP or bucket policy).
            // For an existence check whose sole purpose is duplicate-name prevention, treat any
            // Forbidden response as "unknown / assume non-existent" and let the upload proceed.
            // The subsequent PutObject will surface a real IAM error if credentials are truly invalid.
            if (ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger?.LogWarning(ex, "S3 returned Forbidden when checking existence of key {S3Key}; treating as non-existent and allowing upload to continue.", s3Key);
                return false;
            }

            // IMDS/credentials-related errors often surface as AmazonServiceException or AmazonClientException.
            // If the exception message indicates inability to retrieve credentials from IMDS, return false
            // to avoid crashing the web request in local dev. Log the condition for visibility.
            if (ex.Message != null && ex.Message.Contains("Instance Metadata", StringComparison.OrdinalIgnoreCase))
            {
                _logger?.LogWarning(ex, "S3 credential resolution failed while checking asset existence for key {S3Key}; treating as non-existent.", s3Key);
                return false;
            }

            throw;
        }
        catch (Amazon.Runtime.AmazonClientException ex)
        {
            if (ex.Message != null && ex.Message.Contains("Instance Metadata", StringComparison.OrdinalIgnoreCase))
            {
                _logger?.LogWarning(ex, "S3 client could not retrieve credentials (IMDS); treating asset {S3Key} as non-existent.", s3Key);
                return false;
            }

            throw;
        }
    }
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

    public async Task DeleteObjectAsync(string s3Key)
    {
        try
        {
            var request = new DeleteObjectRequest
            {
                BucketName = _bucketName,
                Key = s3Key
            };

            await _s3Client.DeleteObjectAsync(request);
        }
        catch (AmazonS3Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to delete S3 object {S3Key}", s3Key);
            throw;
        }
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
