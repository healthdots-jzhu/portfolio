using System.Text.Json;
using Portfolio.Api.Models.Dto;

namespace Portfolio.Api.Services;

public interface ILocaleValidator
{
    ValidateLocaleResponse ValidateLocale(string contentJson, string language);
}

public class LocaleValidator : ILocaleValidator
{
    private readonly ILogger<LocaleValidator> _logger;

    public LocaleValidator(ILogger<LocaleValidator> logger)
    {
        _logger = logger;
    }

    public ValidateLocaleResponse ValidateLocale(string contentJson, string language)
    {
        var response = new ValidateLocaleResponse { IsValid = true };

        try
        {
            // 1. Check if it's valid JSON
            var content = JsonDocument.Parse(contentJson);

            // 2. Validate root is an object
            if (content.RootElement.ValueKind != JsonValueKind.Object)
            {
                response.IsValid = false;
                response.Errors.Add(new ValidationError
                {
                    Field = "root",
                    Message = "Content must be a JSON object",
                    Severity = "Error"
                });
                return response;
            }

            // 3. Structure validation - validate array fields are actually arrays
            var arrayFields = new[] { "sections", "socialLinks", "projects" };
            foreach (var field in arrayFields)
            {
                if (content.RootElement.TryGetProperty(field, out var property))
                {
                    if (property.ValueKind != JsonValueKind.Array)
                    {
                        response.IsValid = false;
                        response.Errors.Add(new ValidationError
                        {
                            Field = field,
                            Message = $"Field '{field}' must be an array",
                            Severity = "Error"
                        });
                    }
                }
            }

            // 4. Validate sections structure if present
            if (content.RootElement.TryGetProperty("sections", out var sections))
            {
                if (sections.ValueKind == JsonValueKind.Array)
                {
                    int sectionIndex = 0;
                    foreach (var section in sections.EnumerateArray())
                    {
                        if (section.ValueKind != JsonValueKind.Object)
                        {
                            response.IsValid = false;
                            response.Errors.Add(new ValidationError
                            {
                                Field = $"sections[{sectionIndex}]",
                                Message = "Section must be an object",
                                Severity = "Error"
                            });
                        }
                        sectionIndex++;
                    }
                }
            }

            // 5. Validate social links structure if present
            if (content.RootElement.TryGetProperty("socialLinks", out var socialLinks))
            {
                if (socialLinks.ValueKind == JsonValueKind.Array)
                {
                    int linkIndex = 0;
                    foreach (var link in socialLinks.EnumerateArray())
                    {
                        if (link.ValueKind != JsonValueKind.Object)
                        {
                            response.Warnings.Add(new ValidationWarning
                            {
                                Field = $"socialLinks[{linkIndex}]",
                                Message = "Social link must be an object"
                            });
                        }
                        else if (link.TryGetProperty("url", out var urlProp))
                        {
                            var url = urlProp.GetString();
                            if (!string.IsNullOrEmpty(url) && !IsValidUrl(url))
                            {
                                response.Warnings.Add(new ValidationWarning
                                {
                                    Field = $"socialLinks[{linkIndex}].url",
                                    Message = "URL may not be valid"
                                });
                            }
                        }
                        linkIndex++;
                    }
                }
            }

            // 6. Check for potentially broken links
            if (content.RootElement.TryGetProperty("resumeLink", out var resumeLink))
            {
                var url = resumeLink.GetString();
                if (!string.IsNullOrEmpty(url) && !IsValidUrl(url))
                {
                    response.Warnings.Add(new ValidationWarning
                    {
                        Field = "resumeLink",
                        Message = "Resume link may not be a valid URL"
                    });
                }
            }
        }
        catch (JsonException ex)
        {
            response.IsValid = false;
            response.Errors.Add(new ValidationError
            {
                Field = "root",
                Message = $"Invalid JSON format: {ex.Message}",
                Severity = "Error"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating locale content");
            response.IsValid = false;
            response.Errors.Add(new ValidationError
            {
                Field = "root",
                Message = $"Validation error: {ex.Message}",
                Severity = "Error"
            });
        }

        return response;
    }

    private bool IsValidUrl(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}
