namespace Portfolio.Api.Models.Dto
{
    public class GenerateLocaleRequest
    {
        public string Prompt { get; set; } = string.Empty;
        public string? Area { get; set; }
        public int? VersionId { get; set; }
        public List<string>? Languages { get; set; }
    }
}
