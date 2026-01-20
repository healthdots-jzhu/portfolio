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

            // 2. Required fields validation
            var requiredFields = new[] { "name", "tagline", "email" };
            foreach (var field in requiredFields)
            {
                if (!content.RootElement.TryGetProperty(field, out var property) || 
                    string.IsNullOrWhiteSpace(property.GetString()))
                {
                    response.IsValid = false;
                    response.Errors.Add(new ValidationError
                    {
                        Field = field,
                        Message = $"Required field '{field}' is missing or empty",
                        Severity = "Error"
                    });
                }
            }

            // 3. Structure validation
            if (content.RootElement.TryGetProperty("sections", out var sections))
            {
                if (sections.ValueKind != JsonValueKind.Array)
                {
                    response.IsValid = false;
                    response.Errors.Add(new ValidationError
                    {
                        Field = "sections",
                        Message = "Sections must be an array",
                        Severity = "Error"
                    });
                }
                else
                {
                    // Validate each section
                    int sectionIndex = 0;
                    foreach (var section in sections.EnumerateArray())
                    {
                        if (!section.TryGetProperty("id", out _))
                        {
                            response.Warnings.Add(new ValidationWarning
                            {
                                Field = $"sections[{sectionIndex}]",
                                Message = "Section is missing an 'id' field"
                            });
                        }

                        if (!section.TryGetProperty("title", out _))
                        {
                            response.Warnings.Add(new ValidationWarning
                            {
                                Field = $"sections[{sectionIndex}]",
                                Message = "Section is missing a 'title' field"
                            });
                        }

                        sectionIndex++;
                    }
                }
            }

            // 4. Validate social links structure
            if (content.RootElement.TryGetProperty("socialLinks", out var socialLinks))
            {
                if (socialLinks.ValueKind != JsonValueKind.Array)
                {
                    response.Warnings.Add(new ValidationWarning
                    {
                        Field = "socialLinks",
                        Message = "socialLinks should be an array"
                    });
                }
                else
                {
                    foreach (var link in socialLinks.EnumerateArray())
                    {
                        if (!link.TryGetProperty("url", out _))
                        {
                            response.Warnings.Add(new ValidationWarning
                            {
                                Field = "socialLinks",
                                Message = "Social link is missing 'url' field"
                            });
                        }
                    }
                }
            }

            // 5. Check for potentially broken links
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

            // 6. Language-specific validation
            if (language == "en")
            {
                // English-specific checks if needed
            }
            else if (language == "fr")
            {
                // French-specific checks if needed
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
