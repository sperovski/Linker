---
name: verify
description: Build, launch, and drive the Linker app (ASP.NET API + Angular frontend) to verify changes end-to-end.
---

# Verifying Linker changes

## Environment gotchas

- Work in `~/dev/Linker` (the Desktop copy is a stale iCloud clone).
- The system Node (`/usr/local/bin/node`, v24.12) is too old for the Angular CLI.
  Prefix commands with `PATH="/opt/homebrew/opt/node/bin:$PATH"` (Homebrew Node 25+).
- Postgres runs on localhost:5432. The dev DB is `linker_dev`, credentials in
  `dotnet user-secrets list --project Linker.Api`. The dev DB can lag behind on
  migrations — start the API with `Database__MigrateOnStartup=true` to catch up.

## Launch

```bash
# API on :5256 (user-secrets only load in Development)
cd ~/dev/Linker/Linker.Api && ASPNETCORE_ENVIRONMENT=Development \
  Database__MigrateOnStartup=true dotnet run --no-launch-profile --urls http://localhost:5256

# Frontend on :4200
cd ~/dev/Linker/frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npx ng serve --port 4200
```

Readiness: `curl http://localhost:5256/api/internships` → 200; `curl http://localhost:4200` → 200.

## Test accounts

Existing DB users have unknown passwords; register fresh ones via the API:

```bash
curl -X POST http://localhost:5256/api/auth/register/student -H 'Content-Type: application/json' \
  -d '{"email":"chat.tester.a@example.com","password":"ChatTest123!","firstName":"Ana","lastName":"Testerska"}'
```

Returns a JWT immediately. **JWTs expire in 15 minutes** — re-login rather than
reusing saved tokens.

## Driving the surfaces

- REST: curl with `Authorization: Bearer <token>`.
- SignalR chat hub at `/hubs/chat`: use `@microsoft/signalr` from
  `frontend/node_modules` in a Node script; token via `accessTokenFactory`.
  Browser clients must pass `withCredentials: false` (API CORS has no
  AllowCredentials; auth rides in `access_token`).
- GUI: Playwright 1.61 chromium is installed in the user cache; `npm install
  playwright` in the scratchpad, then drive http://localhost:4200. Login form
  labels: Email / Password; login redirects to /internships (student).

## Build gate

`cd ~/dev/Linker/frontend && PATH="/opt/homebrew/opt/node/bin:$PATH" npm run build`
