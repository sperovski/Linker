# Linker

A .NET 10 solution built with Onion (Clean) Architecture.

## Project structure

```
Linker.sln
├── Linker.Domain          # Entities and interfaces only. No project references.
├── Linker.Application     # Application/business logic. References: Domain.
├── Linker.Infrastructure  # EF Core + PostgreSQL, external concerns. References: Domain, Application.
└── Linker.Api             # ASP.NET Core Web API (Presentation layer). References: Application, Infrastructure.
```

Dependency direction flows inward: `Api → Infrastructure → Application → Domain`, and `Api → Application`.
`Domain` has no dependencies on any other project in the solution.

### Packages

- **Linker.Infrastructure**: `Microsoft.EntityFrameworkCore`, `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.EntityFrameworkCore.Design`
- **Linker.Api**: `Microsoft.AspNetCore.Authentication.JwtBearer`, `Swashbuckle.AspNetCore`

This phase is scaffolding only — no entities, DbContext, or business logic have been added yet.

## Running locally

Requires the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).

```bash
dotnet build
dotnet run --project Linker.Api
```

The API will start with Swagger UI available in the Development environment at `/swagger`.

### PostgreSQL connection

`Linker.Api/appsettings.Development.json` expects a `ConnectionStrings:DefaultConnection` value, e.g.:

```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=linker_dev;Username=postgres;Password=CHANGE_ME"
}
```

No real secrets are committed — replace the placeholder password with your local PostgreSQL credentials.
No database or migrations exist yet as part of this scaffolding phase; that will be added once `Linker.Infrastructure` has a `DbContext` and initial migration.
