
<<<<<<< HEAD
=======
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

### Rate limiting behind a reverse proxy

`/api/auth/*` is rate-limited per client IP. When the API sits behind a reverse
proxy, the connection it sees is the proxy's own IP, not the real caller's —
so `RateLimiting:TrustedProxies` (a list of CIDRs) tells the app which
upstream hops to trust before reading `X-Forwarded-For` / Fly's
`Fly-Client-IP` at all. An empty list (the default, used for plain
`dotnet run`) means nothing is trusted and the raw connection IP is always
used. Docker Compose sets it to nginx's bridge network (`172.16.0.0/12`);
`fly.api.toml` sets it to Fly's private 6PN range (`fdaa::/16`). See
`Linker.Api/RateLimiting/ClientIpResolver.cs` for the resolution logic —
notably, only the *last* hop in `X-Forwarded-For` is trusted (nginx appends
rather than replaces the header, so a client could otherwise prepend a fake
IP and have it believed).

### Database migrations

```bash
dotnet ef database update --project Linker.Infrastructure --startup-project Linker.Api
```

Optional startup flags (used by containers; local dev usually leaves them off):

- `Database__MigrateOnStartup=true` — apply pending migrations on boot.
- `Database__SeedDemoData=true` — idempotently seed skills, demo companies and internships.
- `Seed__AdminEmail` / `Seed__AdminPassword` — create an admin account on boot (any environment).

### Frontend (Angular 22)

```bash
cd frontend
npm ci
npm start        # dev server on http://localhost:4200, API expected on :5256
```

Requires Node 22/24 LTS. The production build (`npx ng build --configuration production`)
swaps in `environment.prod.ts`, which points at a same-origin `/api`.

### Email links (verification / password reset)

Without SMTP configured, emails are **logged to the API console** — grab the
verification/reset link from the log output. To send real email, configure any
SMTP relay:

```
Smtp__Host, Smtp__Port, Smtp__Username, Smtp__Password, Smtp__FromAddress, Smtp__FromName
App__BaseUrl   # public web URL used inside emailed links (default http://localhost:4200)
```

## Tests

```bash
dotnet test                                   # everything
dotnet test Linker.Application.Tests          # unit tests (SQLite in-memory)
dotnet test Linker.Api.IntegrationTests       # full-stack tests (needs Docker: Testcontainers Postgres)
```

## Docker Compose (one-command demo stack)

```bash
docker compose up --build
```

Brings up Postgres + API + frontend at **http://localhost:8080** with migrations
and demo data — demo credentials only, override for anything public.

Demo accounts (all use the password shown, or override via `Seed:DemoPassword`):

| Role    | Email                          | Password           | Notes                                   |
|---------|---------------------------------|---------------------|------------------------------------------|
| Admin   | `admin@linker.local`            | `AdminLocal123!`    | set via `Seed:AdminEmail`/`Seed:AdminPassword` |
| Student | `stefan.perovski20@gmail.com`   | `magii1002`         | Stefan Perovski — has applications (accepted/pending/rejected), saved internships, notifications |
| Student | `marko.ilievski@linker.demo`    | `Demo123!linker`    | Backend-leaning profile with its own application mix |
| Student | `elena.stojanova@linker.demo`   | `Demo123!linker`    | Design-leaning profile |
| Company | `careers@netcetera.demo`        | `Demo123!linker`    | has a received application + notification |
| Company | `careers@endava.demo`           | `Demo123!linker`    | has a received application + notification |

10 companies and 12 internships are seeded regardless (see `careers@<company>.demo`
for the other 8, same password).

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main`: backend build,
unit + integration tests (Testcontainers), and the Angular production build.
On `main` it also publishes `linker-api` and `linker-web` images to GHCR.

## Deploy (Fly.io runbook)

One-time setup, from the repo root (`brew install flyctl`, `fly auth login`):

```bash
# 1. Postgres
fly postgres create --name linker-db --region fra

# 2. API
fly launch --no-deploy -c fly.api.toml            # creates the app from the config
fly postgres attach linker-db -c fly.api.toml      # injects DATABASE_URL; copy it into the secret below
fly secrets set -c fly.api.toml \
  ConnectionStrings__DefaultConnection="Host=<linker-db>.internal;Port=5432;Database=linker_api;Username=...;Password=..." \
  Jwt__Key="$(openssl rand -base64 48)" \
  Seed__AdminEmail="you@example.com" \
  Seed__AdminPassword="<strong password>" \
  App__BaseUrl="https://linker-web.fly.dev"
fly deploy -c fly.api.toml

# 3. Frontend (after the API is up — nginx resolves it at startup)
cd frontend
fly launch --no-deploy
fly deploy
```

The site is then live at `https://linker-web.fly.dev` (nginx serves the SPA and
proxies `/api` to the API over Fly private networking — no CORS involved).
Optionally add `Smtp__*` secrets for real email and `Anthropic__ApiKey` for the
AI CV reviewer.
>>>>>>> c1e97b0 (Add security hardening, features, tests, and deployment config)
