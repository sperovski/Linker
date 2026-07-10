using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Linker.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInternshipSearchTrigramIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Browse/search filters on Title, Description and Location with
            // ILIKE '%text%'. A leading wildcard makes a btree index useless, so
            // those degrade to a sequential scan. gin_trgm_ops indexes support
            // LIKE/ILIKE with wildcards on either side.
            //
            // Raw SQL because EF cannot model a GIN index with an operator class.
            // Patterns shorter than 3 characters have no full trigram to match, so
            // the planner still falls back to a scan for those.
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            migrationBuilder.Sql(
                """
                CREATE INDEX IF NOT EXISTS "IX_Internships_Title_Trgm"
                    ON "Internships" USING gin ("Title" gin_trgm_ops);
                """);

            migrationBuilder.Sql(
                """
                CREATE INDEX IF NOT EXISTS "IX_Internships_Description_Trgm"
                    ON "Internships" USING gin ("Description" gin_trgm_ops);
                """);

            migrationBuilder.Sql(
                """
                CREATE INDEX IF NOT EXISTS "IX_Internships_Location_Trgm"
                    ON "Internships" USING gin ("Location" gin_trgm_ops);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_Internships_Location_Trgm"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_Internships_Description_Trgm"";");
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_Internships_Title_Trgm"";");

            // The extension is left in place: other objects may depend on it, and
            // dropping it is not the inverse of CREATE EXTENSION IF NOT EXISTS.
        }
    }
}
