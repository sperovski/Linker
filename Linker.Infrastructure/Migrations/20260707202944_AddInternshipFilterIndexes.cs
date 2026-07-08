using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Linker.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInternshipFilterIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Internships_ApplicationDeadline",
                table: "Internships",
                column: "ApplicationDeadline");

            migrationBuilder.CreateIndex(
                name: "IX_Internships_IsActive",
                table: "Internships",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Internships_Type",
                table: "Internships",
                column: "Type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Internships_ApplicationDeadline",
                table: "Internships");

            migrationBuilder.DropIndex(
                name: "IX_Internships_IsActive",
                table: "Internships");

            migrationBuilder.DropIndex(
                name: "IX_Internships_Type",
                table: "Internships");
        }
    }
}
