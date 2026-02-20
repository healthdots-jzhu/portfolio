namespace Portfolio.Api.Models.Dto
{
    public class GenerateLocaleRequest
    {
        public string Prompt { get; set; } = string.Empty;
        public int? MaxTokens { get; set; }
        public double? Temperature { get; set; }
    }
}
