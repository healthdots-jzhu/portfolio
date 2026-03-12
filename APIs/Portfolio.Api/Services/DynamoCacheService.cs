using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;

namespace Portfolio.Api.Services
{
    public interface IDynamoCacheService
    {
        Task<string?> GetAsync(string key, string? tableName = null);
        Task<(bool found, string? value)> TryGetAsync(string key, string? tableName = null);
        Task SetAsync(string key, string json, string? tableName = null);
        Task InvalidateForPersonAsync(string personId, string? tableName = null);
    }

    public class DynamoCacheService : IDynamoCacheService
    {
        private readonly IAmazonDynamoDB _dynamoDb;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DynamoCacheService> _logger;
        

        public DynamoCacheService(IAmazonDynamoDB dynamoDb, IConfiguration configuration, ILogger<DynamoCacheService> logger)
        {
            _dynamoDb = dynamoDb ?? throw new ArgumentNullException(nameof(dynamoDb));
            _logger = logger;
            _configuration = configuration;

            // No fallback table name in this service; callers must pass the desired `tableName`.
        }

        private bool IsCompressionEnabledForTable(string tableName)
        {
            if (string.IsNullOrWhiteSpace(tableName)) return false;
            try
            {
                var dyn = _configuration.GetSection("DynamoCache");
                var tables = dyn.GetSection("Tables");
                if (tables.Exists())
                {
                    foreach (var child in tables.GetChildren())
                    {
                        var tn = child["TableName"];
                        if (!string.IsNullOrWhiteSpace(tn) && string.Equals(tn, tableName, StringComparison.OrdinalIgnoreCase))
                        {
                            return child.GetValue<bool?>("EnableCompression") ?? false;
                        }
                    }
                }
            }
            catch { }
            return false;
        }

        public async Task<string?> GetAsync(string key, string? tableName = null)
        {
            var (found, value) = await TryGetAsync(key, tableName);
            return found ? value : null;
        }

        public async Task<(bool found, string? value)> TryGetAsync(string key, string? tableName = null)
        {
            if (string.IsNullOrWhiteSpace(tableName)) return (false, null);
            var table = tableName;

            try
            {
                var request = new GetItemRequest
                {
                    TableName = table!,
                    Key = new Dictionary<string, AttributeValue>
                    {
                        ["CacheKey"] = new AttributeValue { S = key }
                    },
                    ProjectionExpression = "#v, ExpiresAt, IsCompressed",
                    ExpressionAttributeNames = new Dictionary<string, string> { ["#v"] = "Value" }
                };

                var resp = await _dynamoDb.GetItemAsync(request);
                if (resp.Item == null || resp.Item.Count == 0) return (false, null);

                if (resp.Item.TryGetValue("ExpiresAt", out var expiresAttr) && long.TryParse(expiresAttr.N, out var epoch))
                {
                    if (DateTimeOffset.FromUnixTimeSeconds(epoch) < DateTimeOffset.UtcNow)
                    {
                        await _dynamoDb.DeleteItemAsync(new DeleteItemRequest { TableName = table!, Key = new Dictionary<string, AttributeValue> { ["CacheKey"] = new AttributeValue { S = key } } });
                        return (false, null);
                    }
                }

                if (resp.Item.TryGetValue("Value", out var valueAttr))
                {
                    if (resp.Item.TryGetValue("IsCompressed", out var compAttr) && compAttr?.BOOL == true)
                    {
                        try
                        {
                            return (true, DecompressFromBase64(valueAttr.S));
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to decompress cached value for key {Key}", key);
                            return (false, null);
                        }
                    }

                    return (true, valueAttr.S);
                }

                return (false, null);
            }
            catch (Amazon.DynamoDBv2.Model.ResourceNotFoundException rnfe)
            {
                _logger.LogWarning(rnfe, "DynamoDB table not found: {Table}", table);
                return (false, null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DynamoDB TryGet failed for key {Key}", key);
                return (false, null);
            }
        }

        public async Task SetAsync(string key, string json, string? tableName = null)
        {
            if (string.IsNullOrWhiteSpace(tableName)) return;
            var table = tableName;

            // Determine compression setting for this table
            var compressionEnabled = IsCompressionEnabledForTable(tableName);

            try
            {
                var expires = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeSeconds().ToString();
                var item = new Dictionary<string, AttributeValue>
                {
                    ["CacheKey"] = new AttributeValue { S = key },
                    ["ExpiresAt"] = new AttributeValue { N = expires }
                };

                if (compressionEnabled)
                {
                    var compressed = CompressToBase64(json);
                    item["Value"] = new AttributeValue { S = compressed };
                    item["IsCompressed"] = new AttributeValue { BOOL = true };
                }
                else
                {
                    item["Value"] = new AttributeValue { S = json };
                }

                _logger.LogDebug("DynamoDB PutItem preparing for key {Key} into table {Table}", key, table);
                await _dynamoDb.PutItemAsync(new PutItemRequest { TableName = table!, Item = item });
                try
                {
                    _logger.LogDebug("DynamoDB PutItem succeeded for key {Key} into table {Table}", key, table);
                }
                catch { }
            }
            catch (Amazon.DynamoDBv2.Model.ResourceNotFoundException rnfe)
            {
                _logger.LogWarning(rnfe, "DynamoDB table not found when setting cache for key {Key}: {Table}. Ensure the table exists and the app is in the correct AWS account/region.", key, table);
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DynamoDB SetCache failed for key {Key}", key);
            }
        }

        private static string CompressToBase64(string text)
        {
            var bytes = Encoding.UTF8.GetBytes(text);
            using var ms = new MemoryStream();
            using (var gzip = new GZipStream(ms, CompressionLevel.Optimal, true))
            {
                gzip.Write(bytes, 0, bytes.Length);
            }
            return Convert.ToBase64String(ms.ToArray());
        }

        private static string DecompressFromBase64(string base64)
        {
            var compressed = Convert.FromBase64String(base64);
            using var inMs = new MemoryStream(compressed);
            using var gzip = new GZipStream(inMs, CompressionMode.Decompress);
            using var outMs = new MemoryStream();
            gzip.CopyTo(outMs);
            return Encoding.UTF8.GetString(outMs.ToArray());
        }

        public async Task InvalidateForPersonAsync(string personId, string? tableName = null)
        {
            if (string.IsNullOrWhiteSpace(tableName)) return;
            var table = tableName;

            try
            {
                await _dynamoDb.DeleteItemAsync(new DeleteItemRequest
                {
                    TableName = table!,
                    Key = new Dictionary<string, AttributeValue> { ["CacheKey"] = new AttributeValue { S = personId } }
                });

                var prefix = personId + "#";
                var scanReq = new ScanRequest
                {
                    TableName = table!,
                    ProjectionExpression = "CacheKey",
                    FilterExpression = "begins_with(CacheKey, :p)",
                    ExpressionAttributeValues = new Dictionary<string, AttributeValue> { [":p"] = new AttributeValue { S = prefix } }
                };

                var resp = await _dynamoDb.ScanAsync(scanReq);
                if (resp.Items != null)
                {
                    foreach (var item in resp.Items)
                    {
                        if (item.TryGetValue("CacheKey", out var keyAttr) && !string.IsNullOrEmpty(keyAttr.S))
                        {
                            await _dynamoDb.DeleteItemAsync(new DeleteItemRequest
                            {
                                TableName = table!,
                                Key = new Dictionary<string, AttributeValue> { ["CacheKey"] = new AttributeValue { S = keyAttr.S } }
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DynamoDB Invalidate cache failed for person {PersonId}", personId);
            }
        }
    }
}
