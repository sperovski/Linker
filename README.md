# Linker

Linker connects students with companies offering internships.

Students build a profile, upload a CV, and apply to listings. Companies post internships, review who applied, and message candidates. Both sides chat in real time and get notified when something happens.

## Demo

https://github.com/user-attachments/assets/90ebd0eb-a3cc-41e2-b860-5bcdfbbcc15f

## What it's built with

| Part | Tech |
| --- | --- |
| Frontend | Angular 22 |
| Backend | ASP.NET Core (.NET 10) |
| Database | PostgreSQL, via Entity Framework Core |
| Live chat | SignalR |
| Login | JWT tokens, passwords hashed with BCrypt |
| CV reading | PdfPig for PDFs, OpenXML for Word files |
| Running it | Docker Compose |
| Tests | xUnit, with Testcontainers for real database tests |

## Running it locally

```bash
docker compose up
```

The app is then at `http://localhost:8080`. Test emails are caught by Mailpit at `http://localhost:8025` instead of being sent for real.

## How the code is organised

```
Linker.Domain          entities and repository interfaces — no dependencies
Linker.Application     the actual features and business rules
Linker.Infrastructure  database, email, file storage
Linker.Api             HTTP endpoints and the chat hub
frontend               the Angular app
```

Each layer only knows about the ones above it, so the rules stay separate from the plumbing.
