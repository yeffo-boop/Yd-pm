# YeffoHub — Phase Log

Running record of decisions, completed work, verification results, and next
steps for each phase, per the working rules in the project instructions.

---

## Phase 0 — Discovery and architecture

**Date:** 2026-08-27
**Status:** Complete, pending owner approval to begin Phase 1.

### What was built

No application code (by design — Phase 0 is planning only). Delivered
documentation:

- `docs/product-requirements.md` — vision, personas, in/out-of-scope
  feature list, route map, UI screen inventory, non-functional targets.
- `docs/architecture.md` — technology stack with specific versions,
  rationale summary, high-level architecture diagram, module/folder
  layout, theming approach, dependency list, background-job catalog,
  storage approach, implementation-plan recap, open risk register.
- `docs/data-model.md` — full logical domain model across all subsystems
  (org/users, sales, templates, delivery hierarchy, scheduling,
  communication, files/approvals, questionnaires, support, notifications,
  auth lifecycle, auditing, settings, future integration stubs), with
  Mermaid ER diagrams and explicit progress-calculation rules.
- `docs/permissions.md` — role/capability matrix (OWNER vs. CLIENT),
  publication/visibility model, enforcement points, authorization test
  strategy.
- `docs/security.md` — threat-model notes for tenant isolation,
  authentication, invitations, file access, staging-link SSRF avoidance,
  future WooCommerce webhooks, future WordPress SSO, plus an explicit
  "not protected against" section.
- `docs/decisions/0001`–`0008` — ADRs covering: Next.js App Router + Node
  runtime, PostgreSQL + Prisma 7 (not 8), Auth.js v5 + Argon2id + DB
  sessions, pg-boss job queue (vs. BullMQ/Redis), GCS storage abstraction,
  timeline/calendar UI approach (react-big-calendar + custom-built Gantt,
  no third-party Gantt library), Docker Compose deployment, and UUIDs +
  soft deletion + three-table audit/activity split.

### Major decisions (see linked ADRs for full rationale)

| Decision              | Choice                                                                   | Why (one line)                                                                                  |
| --------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Framework             | Next.js 16.3.x, App Router, Node runtime only                            | Spec requirement + argon2/Postgres-pool compatibility (ADR 0001)                                |
| ORM/DB                | PostgreSQL 16 + Prisma 7.x                                               | Prisma 8 is RC-only, not GA (ADR 0002)                                                          |
| Auth                  | Auth.js v5 (Credentials, Prisma adapter, DB sessions) + Argon2id         | Only viable maintained self-hosted option; DB sessions enable immediate invalidation (ADR 0003) |
| Job queue             | pg-boss (Postgres-backed)                                                | No second stateful service needed at this scale (ADR 0004)                                      |
| File storage          | GCS behind a `StorageProvider` port, fake adapter for tests              | Spec requirement; testable without live GCS (ADR 0005)                                          |
| Calendar/Gantt UI     | `react-big-calendar` + custom-built timeline component                   | React-native, accessible-by-construction, avoids an oversized dependency (ADR 0006)             |
| Deployment            | Docker Compose, multi-stage non-root Dockerfile, Caddy example           | Spec requirement, VPS has no Docker yet (ADR 0007)                                              |
| IDs/soft delete/audit | UUIDs, `deletedAt` on business records, 3 separate audit/activity tables | Structural (not filter-based) guarantee against cross-visibility leaks (ADR 0008)               |

### Verification results

Documentation-only phase — no build/test/lint gates apply yet. Verified
instead:

- Repository state: empty, correct branch (`claude/yeffohub-mvp-spec-2valol`),
  no unrelated work present.
- Package version claims (Next.js, Auth.js, Prisma, argon2, pg-boss,
  react-big-calendar, Gantt-library licensing) checked against current
  public sources rather than assumed from training data, given the ~7-month
  gap between knowledge cutoff and today's date.

### Unresolved risks (carried forward, not blocking)

- Auth.js v5 remains on beta-tagged releases despite being the de facto
  production-maintained version; accepted and isolated behind an
  `AuthService` interface (ADR 0003).
- Custom-built Gantt/timeline component is new code YeffoHub owns, not a
  battle-tested library; scoped deliberately small for MVP project sizes
  (ADR 0006).
- pg-boss throughput ceiling is a documented future revisit trigger, not a
  current concern (ADR 0004).
- No values yet for production subdomain, VPS distro, SMTP host, or GCS
  project/bucket — intentionally not requested until the phase that needs
  them (4, 6, 8).
- No final YeffoDesign brand colors, logo, or fonts yet — placeholder
  design tokens will be used, clearly marked for replacement (Phase 1).

### Next steps

Awaiting owner review/approval of this Phase 0 plan. On approval, Phase 1
(Foundation) begins: project scaffolding, tooling, theme system, database,
auth foundation, authorization primitives, Docker dev environment, CI, test
harness, seed strategy, and a minimal authenticated shell for both roles,
with tenant isolation verified at the service/API level before that
checkpoint closes.

**Approved by owner 2026-08-27.**

---

## Phase 1 — Foundation

**Date:** 2026-08-27 – 2026-08-28
**Status:** Complete. Deploying to the owner's VPS for private (owner-only)
testing before Phase 2 begins — see "Next steps" below.

### What was built

- **App scaffold** — Next.js 16.3.3 (App Router, Node runtime only),
  TypeScript 5.9.3 strict, Tailwind CSS 4, ESLint flat config, Prettier.
  `src/theme` tokens live in `src/app/globals.css` as a clearly-marked
  placeholder palette (see docs/architecture.md §5).
- **Database** — `prisma/schema.prisma` (Phase 1 slice: `User`,
  `ClientCompany`, `ClientContact`, `ProjectMembership`, a minimal
  `Project` stub, `AuditLog`, `RateLimitBucket`), one migration, a
  deterministic idempotent seed (`prisma/seed.ts`: one owner, two isolated
  client companies each with a primary + additional contact, one project
  per company).
- **Auth** — Auth.js v5 Credentials provider, Argon2id password hashing,
  JWT sessions with a server-checked `tokenVersion` for immediate
  invalidation (ADR 0003, revised from the originally planned database
  sessions — see below). Postgres-backed rate limiting on login.
- **Authorization** — `src/server/services/authorization.ts` (`Identity`,
  `getAuthorizedProjectScope`) and a project repository that pre-scopes
  every query to the caller's authorized set, never fetch-then-check.
- **Shell UI** — login/logout, an owner dashboard and a client dashboard,
  each listing only the projects that identity is authorized to see;
  role-based route protection in `src/proxy.ts` (Next 16's
  `middleware.ts` → `proxy.ts` rename) plus a second check in each
  route group's layout.
- **Tests** — Vitest unit (password hashing) and integration (real
  Postgres: identity resolution, project scoping, cross-tenant isolation,
  rate limiting — 25 tests) projects; Playwright e2e (6 tests: login,
  role-based redirect, per-tenant dashboard content, wrong-password
  generic error, sign-out).
- **Docker / CI** — multi-stage `Dockerfile` (`runner` + `worker` targets,
  non-root, Next `standalone` output), `compose.yaml` (db/migrate/app/
  worker), `/api/health` + `/api/ready`, GitHub Actions CI (format, lint,
  typecheck, unit, integration, migrate deploy, build, e2e, plus a
  separate job that builds both Docker targets).
- **Ops scaffolding** — `scripts/bootstrap-owner.ts` (documented,
  idempotent-safe first-owner creation, no hard-coded credentials),
  `README.md`, `.env.example`.

### Corrections made during implementation (Phase 0 plans that turned out

to need revision once real code was written against them — each is a full
ADR "Revision" section, summarized here)

- **ADR 0002 (Prisma):** Prisma 7 removed the bundled Rust query engine.
  `schema.prisma` no longer takes a `datasource.url`; the connection
  string moves to `prisma.config.ts`, and `PrismaClient` now requires an
  explicit driver adapter (`@prisma/adapter-pg` + `pg`). Not visible from
  version numbers alone — only surfaced once `prisma validate` was run.
- **ADR 0003 (Auth):** Auth.js's Credentials provider does not support its
  database session strategy (a real, documented upstream limitation, not a
  configuration mistake). Replaced with JWT sessions plus a
  `User.tokenVersion` column checked on every request, which gives the
  same "invalidated immediately, not just at expiry" guarantee the spec
  asked for, at the same per-request DB-lookup cost a database session
  would have had. `@auth/prisma-adapter` was dropped entirely as a
  consequence — nothing in this app's Credentials-only setup needs it.
- **Tooling:** ESLint pinned to 9.39.x rather than the current 10.x line —
  `eslint-config-next@16.3.3`'s bundled `eslint-plugin-react` throws at
  lint time under ESLint 10 (verified by actually running it, not
  inferred from peer-range warnings alone).
- **Next.js 16:** `middleware.ts` is renamed to `proxy.ts` (exported
  function `proxy`), and the Edge runtime is no longer available there at
  all — it always runs on Node. This turned out to reinforce ADR 0001
  rather than complicate it: `src/proxy.ts` calls `auth()` directly, which
  runs the Postgres-backed `tokenVersion` check as part of route
  protection.

### A real bug the integration tests caught

`findProjectForIdentity` built its authorization filter with
`{ ...where, id: projectId }` — object-spread order meant the raw
`id: projectId` silently overwrote the `id: { in: scope.projectIds }`
tenant-scoping clause already in `where`, so a client could fetch **any**
project by id, not just their own. `tests/integration/project-isolation.test.ts`
failed immediately on the first run and named the exact two cases; fixed
by combining the clauses with an explicit `AND` instead of spreading them
into the same object. Left in this log deliberately as the concrete
example of why the isolation tests are a hard requirement, not a
nice-to-have.

### Verification results

All quality gates run and passing locally on 2026-08-28:
format ✅ · lint ✅ · typecheck ✅ · unit tests (4) ✅ · integration tests
(25, including the cross-tenant isolation suite) ✅ · `prisma migrate
deploy` against a real Postgres 16 instance ✅ · production build
(`next build`) ✅ · e2e tests (6, Playwright/Chromium) ✅.

**Not verified — no privileged Docker access in this execution sandbox:**
`docker build` / `docker compose build` for the `runner` and `worker`
image targets. The Dockerfile follows the standard, documented Next.js
`output: "standalone"` multi-stage pattern and `docker compose config`
confirms the compose file itself parses and resolves variables correctly
(including the fix described below), but neither image has actually been
built and run end-to-end yet. CI's `docker-build` job (`.github/workflows/ci.yml`)
builds both targets on every push and will catch a real problem here
before it reaches the VPS — treat its first run as the actual verification
of this piece, and check it before trusting the image in production.

One real bug was caught and fixed before it shipped: `compose.yaml`
originally let a host-level `.env`'s `DATABASE_URL` (which points at
`localhost`, correct for `npm run dev`) leak into the containers, where
`localhost` resolves to the container itself instead of the `db` service.
Fixed by building the containers' `DATABASE_URL` from `POSTGRES_*` values
with the hostname hardcoded to `db`, never falling back to the host-level
variable.

### Unresolved risks (carried forward)

- Docker image builds are unverified by direct execution in this session
  (see above) — first real signal is CI's `docker-build` job.
- Everything from the Phase 0 risk register still applies (Auth.js beta
  versioning, custom Gantt component, pg-boss throughput ceiling, no final
  brand assets yet).
- No SMTP or GCS integration yet — nothing in Phase 1 needed them, so
  those env vars are reserved in `.env.example` but unused.

### Next steps

Owner asked to deploy this Phase 1 build to the real VPS now, for private
(owner-only) testing, before starting Phase 2. See the deployment
checkpoint immediately following this entry for what that required and
the exact steps taken/handed to the owner.

---

## Interim — private VPS deployment (Phase 1 build)

**Date:** 2026-08-28
**Status:** Deployment guide and hardening complete; deployment itself is
the owner's to run (this session has no access to the VPS).

Out of the normal phase sequence, at the owner's explicit request: get the
Phase 1 build running on the real production VPS for private, owner-only
testing before Phase 2 starts. `docs/deployment.md` normally lands in
Phase 8 — this is a scoped-down version written now, honestly limited to
what Phase 1 needs (no SMTP/GCS, no automated backups yet — those stay
Phase 8 work).

### Confirmed environment (from the owner, not assumed)

- VPS: Debian, Docker Engine/Compose not yet installed
- Domain: `hub.yeffodesign.com`, DNS already pointed at the VPS
- Apache already serves other sites on 80/443, with a vhost for this
  subdomain already issued a working HTTPS certificate
- The repository is already cloned on the server

### What changed

- **`compose.yaml` hardened for internet-facing deployment**: `app` and
  `db` now publish to `127.0.0.1` only, not `0.0.0.0` — neither the app
  nor Postgres is directly reachable from the internet; only Apache (via
  its own TLS-terminated vhost) reaches the app, over loopback. This
  wasn't needed for local development but would have been a real exposure
  once bound on a public VPS.
- **`docs/deployment.md`** — concrete walkthrough: Debian Docker install,
  cloning/checking out this branch, generating real secrets (never the
  `.env.example` placeholders), building images, migrating, creating the
  owner's real account via `scripts/bootstrap-owner.ts` (explicitly _not_
  the seed script — seed data is fine for local/CI, not for anything
  internet-reachable), starting `app`/`worker`, and the exact Apache vhost
  snippet to reverse-proxy `hub.yeffodesign.com` to the container
  (`ProxyPreserveHost On` + `RequestHeader set X-Forwarded-Proto "https"`,
  the standard and easy-to-miss requirement for Auth.js's secure-cookie
  and same-origin checks to work correctly behind a proxy that terminates
  TLS itself).
- **README.md** — corrected two "added in Phase 8" references now that
  `docs/deployment.md` exists.

### Why `trustHost: true` (already set in Phase 1) mattered here

Auth.js's Credentials/JWT setup (ADR 0003) needs to know the request
actually arrived over HTTPS even though Apache→container traffic is plain
HTTP internally; `trustHost: true` plus the `X-Forwarded-Proto` header set
in the Apache config is what makes that resolve correctly without a
hard-coded `AUTH_URL`.

### Verification

- `docker compose config` re-validated after the port-binding change:
  confirms `host_ip: 127.0.0.1` on both `app` and `db`.
- Actual deployment execution, and the resulting live site, are the
  owner's to run and confirm — this session has no network path to the
  VPS. Flagged explicitly, not glossed over: nothing above has been
  observed running on the real server.

### Unresolved risk

Same Docker-build-unverified-by-this-session caveat as the Phase 1 entry
above — the deployment guide's `docker compose build` step is the first
time these exact images will actually be built. If it fails, the error
will be concrete and actionable (a real build log), not a repeat of an
already-known problem.
