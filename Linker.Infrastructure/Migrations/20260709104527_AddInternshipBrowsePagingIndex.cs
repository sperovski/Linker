using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Linker.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInternshipBrowsePagingIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Internships_IsActive_CreatedAtUtc",
                table: "Internships",
                columns: new[] { "IsActive", "CreatedAtUtc" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Internships_IsActive_CreatedAtUtc",
                table: "Internships");
        }
    }
}
