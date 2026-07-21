using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Linker.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFacultyChatRoomUniqueTitle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_ChatRooms_Title",
                table: "ChatRooms",
                column: "Title",
                unique: true,
                filter: "\"Type\" = 3");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ChatRooms_Title",
                table: "ChatRooms");
        }
    }
}
