using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Portfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class LocaleAsText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ContentJson",
                table: "PortfolioLocales",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "json");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ContentJson",
                table: "PortfolioLocales",
                type: "json",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
