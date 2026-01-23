namespace Portfolio.Api.Models.Dto
{
    public class GenerateLocaleRequest
    {
        public string Prompt { get; set; } = string.Empty;
        public bool DryRun { get; set; } = true;
        public int? MaxTokens { get; set; }
        public double? Temperature { get; set; }
    }
}
