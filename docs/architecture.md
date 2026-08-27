# YeffoHub — Architecture (Phase 0)

Status: proposed, pending owner approval. Package versions verified against
public registries/release notes as of 2026-08-27; re-verify with `npm outdated`
/ `npm audit` before Phase 1 `npm install` in case of releases between now and
implementation.

## 1. Guiding constraints

- Self-hostable end-to-end: no required paid SaaS dependency. Every managed
  service (GCS, SMTP) has a documented free-tier or low-cost path and a
  swappable interface.
- Single Next.js application, deployed as one Node.js process (plus a worker
  process for background jobs) inside Docker Compose on a plain Linux VPS —
  no Vercel-specific APIs, no Edge runtime. This is what makes an argon2
  native module, a long-lived Postgres connection pool, and a Node-based job
  worker all straightforward (see ADR 0001).
- Domain logic lives in a framework-agnostic service layer, not in route
  handlers or components, so it is unit-testable without HTTP/React and so
  Auth.js, GCS, and the future WooCommerce bridge are swappable adapters
  behind interfaces (ports-and-adapters / hexagonal, kept lightweight — no
  DI framework, just TypeScript interfaces + constructor injection).
- One source of truth per fact: dates, progress, permissions, and status
  are computed/stored once and read everywhere (dashboard, Kanban, calendar,
  Gantt, client portal) from the same Prisma models and service functions.

## 2. Technology stack and versions

| Concern | Choice | Version (baseline, re-check at Phase 1 install) | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.3.x | Latest stable line per spec instruction; Node runtime only, no Edge |
| Language | TypeScript | 5.9.x, `strict: true` | |
| Runtime | Node.js | 22.x LTS | matches Next 16 support matrix |
| Database | PostgreSQL | 16.x | Docker official image, pinned minor |
| ORM | Prisma | 7.x (`prisma`, `@prisma/client`) | v7 is current GA; v8 is RC-only as of this writing — do not adopt until GA + soak time (see ADR 0002) |
| Auth | Auth.js (NextAuth) v5, Credentials provider + Prisma adapter | `next-auth@5.0.0-beta.3x` pinned exact version | Ships under a long-lived beta tag but is the maintained, production-used release; risk accepted and documented in ADR 0003 |
| Password hashing | `argon2` (node-argon2, native binding), Argon2id | latest 0.4x | Native module is fine because we control the Docker runtime (Node, not Edge/serverless) |
| Styling | Tailwind CSS | 4.x | |
| UI primitives | Radix UI primitives + local shadcn/ui-style components (copied in, not an npm dependency) | latest | Keeps full control over accessibility and styling, no black-box component library |
| Drag & drop / accessible interactions | `@dnd-kit/core` + `@dnd-kit/sortable` | latest | MIT, built with keyboard/screen-reader support as a first-class concern — used for Kanban and the custom timeline (see ADR 0006) |
| Calendar (month/week) | `react-big-calendar` | latest | MIT license, mature, supports month/week/agenda |
| Timeline / Gantt-style view | Custom-built component (CSS grid + `dnd-kit`), not a third-party Gantt library | n/a | Rationale and alternatives considered in ADR 0006 |
| Forms & validation | `react-hook-form` + `zod` | latest | Zod schemas shared between client forms, server actions, and API boundaries (single validation source) |
| Background jobs / scheduling | `pg-boss` | latest 10.x | Postgres-native queue (`SKIP LOCKED`), no Redis dependency; see ADR 0004 |
| Object storage | Google Cloud Storage via `@google-cloud/storage`, behind an internal `StorageProvider` interface | latest | Private bucket, signed URLs; fake in-memory adapter for tests; see ADR 0005 |
| Email | `nodemailer` over SMTP, behind an internal `MailProvider` interface | latest | Business SMTP; Mailhog/Maildev for local dev capture |
| Testing (unit/integration) | Vitest + Testing Library | latest | |
| Testing (E2E) | Playwright | latest | |
| Lint/format | ESLint (flat config) + Prettier | latest | |
| CI | GitHub Actions | n/a | lint, typecheck, unit, integration (Postgres service container), Prisma migrate diff check, build, Playwright smoke |
| Containerization | Docker Compose (`compose.yaml`), multi-stage Dockerfile | Docker Engine 27.x+ / Compose v2 plugin | Non-root runtime user |
| Reverse proxy | Caddy (example config) | latest | Automatic HTTPS via Let's Encrypt; Nginx example included as an alternative |

### 2.1 Why these, briefly (full reasoning in ADRs)
- **Prisma 7, not 8** — Prisma 8 is release-candidate only; the spec requires
  verified, non-deprecated, mutually compatible versions, so we start on the
  supported GA line and treat a Prisma 8 upgrade as a tracked future ADR once
  it is GA and has a stable Auth.js adapter.
- **Auth.js v5** — the only actively used, actively maintained, self-hosted
  auth library for Next.js App Router with a Credentials provider and a
  database session strategy (needed for immediate session invalidation on
  password change, which JWT-only strategies can't do without a revocation
  list). It has stayed on `5.0.0-beta.x` version tags well past general
  production adoption; we pin an exact beta version, track its changelog,
  and isolate all Auth.js-specific code behind an `AuthService` interface so
  a future swap (e.g., to a stable release, or off Auth.js entirely) touches
  one module, not the app.
- **pg-boss over BullMQ** — BullMQ is more feature-rich but requires
  operating Redis as a second stateful service for ~25-project MVP-scale job
  volume (deadline reminders, email retries, recurring maintenance
  generation — at most a few hundred jobs/day). pg-boss runs entirely inside
  the Postgres instance we already operate and back up, uses
  `FOR UPDATE SKIP LOCKED` for safe concurrent workers, and lets us enqueue a
  job in the same transaction as the business write it depends on (e.g.,
  "create approval-request notification" enqueued atomically with the
  approval-request row). Tradeoff: lower raw throughput ceiling and fewer
  built-in primitives (rate limiting, job flows) than BullMQ — acceptable at
  this scale; documented as revisitable if job volume grows an order of
  magnitude.
- **No third-party Gantt library** — see ADR 0006.

## 3. High-level architecture

```mermaid
flowchart LR
    subgraph Browser
        OwnerUI[Owner workspace - Next.js App Router]
        ClientUI[Client portal - Next.js App Router]
    end

    subgraph Server["Next.js server (Node runtime, Docker container)"]
        RSC[Server Components / Server Actions / Route Handlers]
        SVC[Domain service layer\n(projects, scheduling, files, approvals, notifications...)]
        AUTH[AuthService\n(Auth.js adapter)]
        RSC --> SVC
        SVC --> AUTH
    end

    subgraph Worker["Job worker process (same image, different entrypoint)"]
        PGBOSS[pg-boss workers:\nemail send, reminders,\nrecurring maintenance,\ncleanup/reconciliation]
    end

    DB[(PostgreSQL)]
    GCS[(Google Cloud Storage\nprivate bucket)]
    SMTP[[Business SMTP]]

    OwnerUI <--> RSC
    ClientUI <--> RSC
    SVC <--> DB
    PGBOSS <--> DB
    SVC -- enqueue jobs --> DB
    SVC -- signed URLs / metadata --> GCS
    PGBOSS -- send mail --> SMTP
    PGBOSS -- issue cleanup calls --> GCS
```

The **worker** is the same application image run with a different start
command (`node worker.js` vs `next start`), so there is exactly one codebase
and one set of domain services — the worker calls the same service-layer
functions the web process does, never duplicated logic.

## 4. Module / folder layout (established in Phase 1, documented now so later
phases don't drift)

```
src/
  app/                     # Next.js App Router routes (owner/, client/, auth/, api/)
  components/              # Reusable UI components (design-system + feature components)
  server/
    services/              # Domain logic: project, scheduling, files, approvals,
                            #   notifications, questionnaires, support, sales, auth
    repositories/           # Prisma-backed data access, one per aggregate
    ports/                  # Interfaces: StorageProvider, MailProvider, AuthProvider,
                            #   IntegrationInbox (future WooCommerce)
    adapters/
      storage-gcs/
      storage-fake/         # in-memory adapter used by tests
      mail-smtp/
      mail-devcapture/
      auth-authjs/
    jobs/                   # pg-boss job definitions + handlers, shared with worker.ts
    validation/              # zod schemas, imported by both server actions and forms
  lib/                       # cross-cutting utilities (time zone, slug/number generation, etc.)
  theme/                     # design tokens (see §5)
prisma/
  schema.prisma
  migrations/
  seed.ts
worker.ts                    # background worker entrypoint
docs/
tests/
  unit/  integration/  e2e/
```

Rule enforced from Phase 1 onward: **route handlers and server actions never
contain authorization or business logic directly** — they parse/validate
input (zod), call a service function with the authenticated identity, and
shape the response. This is what makes the cross-client isolation tests in
`docs/security.md` meaningful at the service layer, not just the HTTP layer.

## 5. Theming ("temporary, clearly marked placeholders")

- `src/theme/tokens.ts` (or CSS custom properties in `globals.css`, finalized
  in Phase 1) defines color, typography, spacing, radius, shadow, and motion
  tokens as named variables (`--color-brand-primary`, `--font-display`,
  etc.), never raw hex values inline in components.
- Until real YeffoDesign brand values are supplied, tokens use a clearly
  labeled placeholder palette (e.g., a neutral slate/indigo technical
  palette) with a `// PLACEHOLDER — replace with YeffoDesign brand value`
  comment on every temporary value, and a single `docs/branding-todo.md`
  (created in Phase 1) listing exactly which tokens, the logo file, and the
  favicon need replacing.
- Direction: technical/futuristic but restrained — strong type hierarchy,
  limited high-contrast accents, no default neon-on-black or heavy
  glassmorphism, motion limited to short, purposeful transitions with
  `prefers-reduced-motion` respected globally.

## 6. Dependency list and justification

Kept intentionally small; every entry above earns its place by covering a
requirement the framework/stdlib doesn't (validation, drag accessibility,
calendar rendering, native password hashing, Postgres-backed queueing,
object storage SDK, mail transport, testing). No UI kit, no CSS-in-JS
runtime, no state-management library (React Server Components + server
actions + minimal client state avoid the need), no ORM alternative, no
second database, no search engine (Postgres `tsvector`/trigram covers the
~25-project scale per spec §9/§17), no analytics/telemetry SaaS in the MVP.

## 7. Background jobs (pg-boss) — job catalog (Phase 4/7 implement; named now
for schema/queue stability)

`deadline-reminder`, `send-email`, `recurring-maintenance-generate`,
`file-upload-reconcile` (cleans up orphaned GCS objects / stuck upload
records), `notification-fanout`. Each job payload carries a deterministic
idempotency key (e.g., `reminder:{taskId}:{offsetDays}:{dueDateISO}` or
`maintenance:{templateId}:{scheduledForISO}`) enforced by a unique DB
constraint on a `job_dedupe_key` column, independent of pg-boss's own retry
semantics, so a worker crash-and-retry or a duplicate enqueue can never
produce a duplicate email or duplicate maintenance task.

## 8. Storage (Google Cloud Storage) — see ADR 0005 for full detail

`StorageProvider` interface: `createUploadTarget()`, `createDownloadUrl()`,
`deleteObject()`. Object keys are server-generated UUIDs, never derived from
the client-supplied filename; the original filename is stored only as
metadata. Every signed-URL issuance first re-checks authorization against
the current database state (project membership, file visibility) — signed
URLs are short-lived (minutes) and single-purpose, not cached or reused.

## 9. Implementation plan (recap of the phase sequence — detail owned by each
phase's own checkpoint, not repeated here)

Phase 1 Foundation → Phase 2 Sales conversion & client management → Phase 3
Core project management → Phase 4 Scheduling & notifications → Phase 5
Client portal & questionnaires → Phase 6 Files/deliverables/approvals →
Phase 7 Support & maintenance → Phase 8 Production hardening & deployment.
Each phase ends with the quality gates in `docs/testing.md` (format, lint,
typecheck, unit, integration, migration validation, build, relevant e2e) and
a written checkpoint before the next phase starts.

## 10. Open risk register (carried forward, not blocking Phase 0 approval)

| Risk | Mitigation |
|---|---|
| Auth.js v5 stays on beta version tags indefinitely | Pin exact version, isolate behind `AuthService`, track upstream changelog each phase |
| pg-boss throughput ceiling if project count grows well past MVP scale | Documented swap path to BullMQ+Redis behind the same job-enqueue interface if ever needed |
| No third-party Gantt library means we own timeline rendering/edge cases | Scoped intentionally small (bars = milestones/phases, not full critical-path scheduling); revisit only if the custom component can't keep up |
| GCS free-tier limits / billing account setup | Documented in Phase 6/8, needs owner's GCP project — requested when that phase starts, not before |
| Argon2 native binding in Docker build | Multi-stage Dockerfile builds on the target platform (no cross-compilation surprises); verified in CI's Linux runner, matching prod |
