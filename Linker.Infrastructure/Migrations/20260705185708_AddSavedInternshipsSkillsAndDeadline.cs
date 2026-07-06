using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Linker.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedInternshipsSkillsAndDeadline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "ApplicationDeadline",
                table: "Internships",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InternshipSkills",
                columns: table => new
                {
                    InternshipId = table.Column<int>(type: "integer", nullable: false),
                    SkillId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternshipSkills", x => new { x.InternshipId, x.SkillId });
                    table.ForeignKey(
                        name: "FK_InternshipSkills_Internships_InternshipId",
                        column: x => x.InternshipId,
                        principalTable: "Internships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InternshipSkills_Skills_SkillId",
                        column: x => x.SkillId,
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SavedInternships",
                columns: table => new
                {
                    StudentId = table.Column<int>(type: "integer", nullable: false),
                    InternshipId = table.Column<int>(type: "integer", nullable: false),
                    SavedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedInternships", x => new { x.StudentId, x.InternshipId });
                    table.ForeignKey(
                        name: "FK_SavedInternships_Internships_InternshipId",
                        column: x => x.InternshipId,
                        principalTable: "Internships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SavedInternships_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InternshipSkills_SkillId",
                table: "InternshipSkills",
                column: "SkillId");

            migrationBuilder.CreateIndex(
                name: "IX_SavedInternships_InternshipId",
                table: "SavedInternships",
                column: "InternshipId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InternshipSkills");

            migrationBuilder.DropTable(
                name: "SavedInternships");

            migrationBuilder.DropColumn(
                name: "ApplicationDeadline",
                table: "Internships");
        }
    }
}
