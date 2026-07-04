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

- **Linker.Application**: `BCrypt.Net-Next` (password hashing)

## Running locally

Requires the [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0).

```bash
dotnet build
dotnet run --project Linker.Api
```

The API will start with Swagger UI available in the Development environment at `/swagger`.

### Configuration and secrets

`Linker.Api/appsettings.Development.json` contains **placeholders only** for the PostgreSQL
connection string (`ConnectionStrings:DefaultConnection`) and the JWT signing key (`Jwt:Key`).
No real secrets are committed. Override them locally with user-secrets:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Host=localhost;Port=5432;Database=linker_dev;Username=postgres;Password=<your-password>" \
  --project Linker.Api
dotnet user-secrets set "Jwt:Key" "$(openssl rand -base64 48)" --project Linker.Api
```

or via environment variables (`ConnectionStrings__DefaultConnection`, `Jwt__Key`).

### Database migrations

```bash
dotnet ef database update --project Linker.Infrastructure --startup-project Linker.Api
```
