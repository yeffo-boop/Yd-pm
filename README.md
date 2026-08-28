# YeffoHub

A self-hosted client and project management application for YeffoDesign, a
website-design business. YeffoHub tracks the full lifecycle of a website
project — inquiry, proposal, onboarding, delivery phases, deliverable
review/approval, launch, and post-launch support — for an owner/admin
workspace and a separate client portal.

See `docs/product-requirements.md` for the full product scope, and
`docs/phase-log.md` for what has been built so far and what's next. This
project is being built in phases (Phase 0: architecture, Phase 1:
foundation, …) with a checkpoint after each; the current state reflects
whichever phase was most recently completed.

## Status

**Phase 1 (Foundation) complete.** The app has: project scaffolding and
tooling, a Postgres/Prisma database with a foundation-slice schema,
Auth.js-based email/password authentication with server-enforced session
invalidation, tenant-isolated authorization primitives (verified by an
integration test suite), a minimal authenticated shell for both the
`OWNER` and `CLIENT` roles, a Docker Compose dev/prod environment, and CI.
Full project delivery features (phases/milestones/tasks, scheduling,
files, questionnaires, support) land in later phases per
`docs/phase-log.md`.

## Documentation

| Doc                            | Contents                                         |
| ------------------------------ | ------------------------------------------------ |
| `docs/product-requirements.md` | Product scope, personas, route map, UI inventory |
| `docs/architecture.md`         | Tech stack, service boundaries, folder layout    |
| `docs/data-model.md`           | Domain model with Mermaid ER diagrams            |
| `docs/permissions.md`          | Role/visibility matrix, authorization model      |
| `docs/security.md`             | Threat model notes                               |
| `docs/decisions/`              | ADRs for consequential architecture choices      |
| `docs/phase-log.md`            | Phase-by-phase build log                         |

## Tech stack

Next.js (App Router, Node runtime) · TypeScript (strict) · PostgreSQL ·
Prisma ORM 7 · Auth.js v5 (Credentials) · Argon2id · Tailwind CSS · pg-boss
· Docker Compose. See `docs/architecture.md` for the full list and the
reasoning behind each choice.

## Prerequisites

- Node.js 22.x and npm
- A local PostgreSQL 16 instance (or Docker, to run one via Compose)
- Docker Engine + Compose plugin (optional for local dev; required for the
  production-shaped deployment path — see `docs/deployment.md`, added in
  Phase 8)

## Quick start (local development)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL to point at your Postgres instance, and set
# AUTH_SECRET to a random value (openssl rand -base64 32).

# 3. Start Postgres (skip if you already have one running)
docker compose up -d db

# 4. Apply the database schema
npx prisma migrate deploy

# 5. Seed deterministic development data (fictional companies/contacts —
#    see prisma/seed.ts; never real client data)
npm run seed
# Prints the seeded accounts and a shared dev-only password.

# 6. Run the app
npm run dev
```

Then sign in at <http://localhost:3000/login> with one of the accounts the
seed script prints (e.g. `owner@yeffodesign.test`).

### Creating a real (non-seed) owner account

Seed data is for local development only. To bootstrap the first real
`OWNER` account on a fresh database (e.g. before first production use):

```bash
OWNER_BOOTSTRAP_EMAIL=you@yeffodesign.com \
OWNER_BOOTSTRAP_PASSWORD='a strong, unique password' \
npm run bootstrap:owner
```

The script refuses to run if an `OWNER` already exists — see
`scripts/bootstrap-owner.ts`.

## Common scripts

| Command                           | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run dev`                     | Start the Next.js dev server                            |
| `npm run build` / `npm run start` | Production build / run it                               |
| `npm run worker`                  | Run the background job worker (pg-boss)                 |
| `npm run lint` / `npm run format` | ESLint / Prettier check                                 |
| `npm run typecheck`               | `tsc --noEmit`                                          |
| `npm run test`                    | Unit tests (Vitest)                                     |
| `npm run test:integration`        | Integration tests against a real Postgres test database |
| `npm run test:e2e`                | End-to-end tests (Playwright)                           |
| `npm run prisma:migrate`          | Create/apply a dev migration                            |
| `npm run prisma:studio`           | Prisma Studio (data browser)                            |
| `npm run seed`                    | Run the deterministic dev seed                          |

## Running with Docker Compose

```bash
cp .env.example .env   # set AUTH_SECRET and ENCRYPTION_MASTER_KEY at minimum
docker compose up -d db
docker compose run --rm migrate
docker compose up -d app worker
```

See `docs/decisions/0007-docker-compose-deployment.md` for the reasoning,
and `docs/deployment.md` (added in Phase 8) for the full production
deployment procedure, reverse proxy setup, and backups.

## Testing

`docs/testing.md` (added alongside the test harness expansion in later
phases) will document the full test strategy and the mapping from the
master spec's end-to-end scenarios to Playwright specs. For now:
`tests/unit`, `tests/integration` (real database, tenant-isolation
coverage included), and `tests/e2e` (Playwright) — see `package.json` for
how to run each.

## Contributing / working conventions

See the ADRs under `docs/decisions/` before making a consequential
architecture change, and `docs/phase-log.md` for what's already decided
versus what's still open. Domain logic lives in `src/server/services` and
`src/server/repositories`, never directly in route handlers or
components — see `docs/architecture.md` §4.
