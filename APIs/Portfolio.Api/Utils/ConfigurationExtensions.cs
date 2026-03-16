using System;
using Microsoft.Extensions.Configuration;

namespace Portfolio.Api.Utils
{
    public static class ConfigurationExtensions
    {
        public static string? ResolveDynamoCacheTableName(this IConfiguration configuration, string key)
        {
            try
            {
                var tables = configuration.GetSection("DynamoCache:Tables");
                if (tables.Exists())
                {
                    var tableName = tables.GetSection(key)["TableName"];
                    if (!string.IsNullOrWhiteSpace(tableName)) return tableName;
                }

                var legacy = configuration["DynamoCache:TableName"];
                return string.IsNullOrWhiteSpace(legacy) ? null : legacy;
            }
            catch
            {
                return null;
            }
        }
    }
}
