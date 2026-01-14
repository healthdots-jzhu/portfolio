using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Portfolio.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateUserSubjectAndProvider : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "CognitoSub",
                table: "Users",
                newName: "Subject");

            migrationBuilder.RenameIndex(
                name: "IX_Users_CognitoSub",
                table: "Users",
                newName: "IX_Users_Subject");

            migrationBuilder.AddColumn<string>(
                name: "Issuer",
                table: "Users",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastLoginAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "Users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Subject_Issuer",
                table: "Users",
                columns: new[] { "Subject", "Issuer" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Subject_Issuer",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Issuer",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "Users");

            migrationBuilder.RenameColumn(
                name: "Subject",
                table: "Users",
                newName: "CognitoSub");

            migrationBuilder.RenameIndex(
                name: "IX_Users_Subject",
                table: "Users",
                newName: "IX_Users_CognitoSub");
        }
    }
}
