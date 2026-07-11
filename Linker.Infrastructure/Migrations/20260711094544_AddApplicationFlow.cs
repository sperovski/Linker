using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Linker.Infrastructure.Migrations
{
    /// <inheritdoc />
    /// <remarks>
    /// Hand-edited: the scaffold dropped CoverLetter and re-added CreatedAt with a
    /// year-0001 default, erasing existing cover letters and application dates.
    /// Both are true renames here, so data survives.
    /// </remarks>
    public partial class AddApplicationFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // CoverLetter -> CoverNote, shrinking 4000 -> 1000. Truncate the few
            // legacy rows that exceed the new cap first, or the ALTER fails.
            migrationBuilder.RenameColumn(
                name: "CoverLetter",
                table: "Applications",
                newName: "CoverNote");

            migrationBuilder.Sql(
                """
                UPDATE "Applications"
                SET "CoverNote" = left("CoverNote", 1000)
                WHERE length("CoverNote") > 1000;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "CoverNote",
                table: "Applications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(4000)",
                oldMaxLength: 4000,
                oldNullable: true);

            // AppliedAtUtc -> CreatedAt keeps every application's original date.
            migrationBuilder.RenameColumn(
                name: "AppliedAtUtc",
                table: "Applications",
                newName: "CreatedAt");

            // UpdatedAt starts equal to CreatedAt (nothing has acted on the
            // application since it was filed), then becomes NOT NULL.
            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Applications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "Applications" SET "UpdatedAt" = "CreatedAt";
                """);

            migrationBuilder.AlterColumn<DateTime>(
                name: "UpdatedAt",
                table: "Applications",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Applications");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Applications",
                newName: "AppliedAtUtc");

            migrationBuilder.AlterColumn<string>(
                name: "CoverNote",
                table: "Applications",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.RenameColumn(
                name: "CoverNote",
                table: "Applications",
                newName: "CoverLetter");
        }
    }
}
