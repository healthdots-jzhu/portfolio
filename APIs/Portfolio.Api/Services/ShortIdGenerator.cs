using HashidsNet;
using Microsoft.Extensions.Logging;

namespace Portfolio.Api.Services;

/// <summary>
/// Generates obfuscated 6-character alphanumeric Portfolio IDs using Hashids.
/// Maps sequential database IDs to collision-free, deterministic short strings.
/// Example: SequentialId 1 → "EU2OPK", SequentialId 2 → "P1K9AB"
/// </summary>
public interface IShortIdGenerator
{
    /// <summary>
    /// Encodes a sequential database ID to a 6-character short ID.
    /// </summary>
    string Encode(long sequentialId);

    /// <summary>
    /// Decodes a short ID back to its sequential database ID.
    /// Returns -1 if decoding fails.
    /// </summary>
    long Decode(string shortId);
}

public class ShortIdGenerator : IShortIdGenerator
{
    private readonly Hashids _hashids;
    private readonly ILogger<ShortIdGenerator> _logger;

    /// <summary>
    /// Initializes a new ShortIdGenerator with a configurable salt.
    /// </summary>
    /// <param name="salt">Salt for Hashids (acts like a seed; keep consistent across app versions)</param>
    /// <param name="logger">Logger for diagnostics</param>
    public ShortIdGenerator(string salt, ILogger<ShortIdGenerator> logger)
    {
        // minHashLength=6 ensures output is always 6 characters
        _hashids = new Hashids(salt: salt, minHashLength: 6);
        _logger = logger;
    }

    public string Encode(long sequentialId)
    {
        try
        {
            var encoded = _hashids.Encode((int)sequentialId);
            _logger.LogDebug("Encoded SequentialId {SequentialId} to {ShortId}", sequentialId, encoded);
            return encoded;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to encode SequentialId {SequentialId}", sequentialId);
            throw;
        }
    }

    public long Decode(string shortId)
    {
        try
        {
            var decoded = _hashids.Decode(shortId);
            if (decoded.Length == 0)
            {
                _logger.LogWarning("Failed to decode ShortId {ShortId}: no result", shortId);
                return -1;
            }

            var sequentialId = (long)decoded[0];
            _logger.LogDebug("Decoded ShortId {ShortId} to SequentialId {SequentialId}", shortId, sequentialId);
            return sequentialId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to decode ShortId {ShortId}", shortId);
            return -1;
        }
    }
}
