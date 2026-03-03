using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;

namespace Portfolio.Api.Services
{
    public interface IDynamoCacheService
    {
        Task<string?> GetAsync(string key);
        Task SetAsync(string key, string json);
        Task InvalidateForPersonAsync(string personId);
    }

    public class DynamoCacheService : IDynamoCacheService
    {
        private readonly IAmazonDynamoDB _dynamoDb;
        private readonly string? _tableName;
        private readonly ILogger<DynamoCacheService> _logger;
        private readonly bool _enabled;

        public DynamoCacheService(IAmazonDynamoDB dynamoDb, IConfiguration configuration, ILogger<DynamoCacheService> logger)
        {
            _dynamoDb = dynamoDb ?? throw new ArgumentNullException(nameof(dynamoDb));
            _logger = logger;
            _tableName = configuration["DynamoCache:TableName"] ?? Environment.GetEnvironmentVariable("DynamoCache__TableName");
            _enabled = !string.IsNullOrWhiteSpace(_tableName);
        }

        public async Task<string?> GetAsync(string key)
        {
            if (!_enabled) return null;

            try
            {
                var request = new GetItemRequest
                {
                    TableName = _tableName!,
                    Key = new Dictionary<string, AttributeValue>
                    {
                        ["CacheKey"] = new AttributeValue { S = key }
                    },
                    ProjectionExpression = "#v, ExpiresAt",
                    ExpressionAttributeNames = new Dictionary<string, string> { ["#v"] = "Value" }
                };

                var resp = await _dynamoDb.GetItemAsync(request);
                if (resp.Item == null || resp.Item.Count == 0) return null;

                if (resp.Item.TryGetValue("ExpiresAt", out var expiresAttr) && long.TryParse(expiresAttr.N, out var epoch))
                {
                    if (DateTimeOffset.FromUnixTimeSeconds(epoch) < DateTimeOffset.UtcNow)
                    {
                        await _dynamoDb.DeleteItemAsync(new DeleteItemRequest { TableName = _tableName!, Key = new Dictionary<string, AttributeValue> { ["CacheKey"] = new AttributeValue { S = key } } });
                        return null;
                    }
                }

                if (resp.Item.TryGetValue("Value", out var valueAttr))
                {
                    return valueAttr.S;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DynamoDB GetCache failed for key {Key}", key);
            }

            return null;
        }

        public async Task SetAsync(string key, string json)
        {
            if (!_enabled) return;

            try
            {
                var expires = DateTimeOffset.UtcNow.AddHours(24).ToUnixTimeSeconds().ToString();
                var item = new Dictionary<string, AttributeValue>
                {
                    ["CacheKey"] = new AttributeValue { S = key },
                    ["Value"] = new AttributeValue { S = json },
                    ["ExpiresAt"] = new AttributeValue { N = expires }
                };

                await _dynamoDb.PutItemAsync(new PutItemRequest { TableName = _tableName!, Item = item });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DynamoDB SetCache failed for key {Key}", key);
            }
        }

        public async Task InvalidateForPersonAsync(string personId)
        {
            if (!_enabled) return;

            try
            {
                await _dynamoDb.DeleteItemAsync(new DeleteItemRequest
                {
                    TableName = _tableName!,
                    Key = new Dictionary<string, AttributeValue> { ["CacheKey"] = new AttributeValue { S = personId } }
                });

                var prefix = personId + "#";
                var scanReq = new ScanRequest
                {
                    TableName = _tableName!,
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
                                TableName = _tableName!,
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
