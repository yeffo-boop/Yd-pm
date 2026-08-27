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
| Decision | Choice | Why (one line) |
|---|---|---|
| Framework | Next.js 16.3.x, App Router, Node runtime only | Spec requirement + argon2/Postgres-pool compatibility (ADR 0001) |
| ORM/DB | PostgreSQL 16 + Prisma 7.x | Prisma 8 is RC-only, not GA (ADR 0002) |
| Auth | Auth.js v5 (Credentials, Prisma adapter, DB sessions) + Argon2id | Only viable maintained self-hosted option; DB sessions enable immediate invalidation (ADR 0003) |
| Job queue | pg-boss (Postgres-backed) | No second stateful service needed at this scale (ADR 0004) |
| File storage | GCS behind a `StorageProvider` port, fake adapter for tests | Spec requirement; testable without live GCS (ADR 0005) |
| Calendar/Gantt UI | `react-big-calendar` + custom-built timeline component | React-native, accessible-by-construction, avoids an oversized dependency (ADR 0006) |
| Deployment | Docker Compose, multi-stage non-root Dockerfile, Caddy example | Spec requirement, VPS has no Docker yet (ADR 0007) |
| IDs/soft delete/audit | UUIDs, `deletedAt` on business records, 3 separate audit/activity tables | Structural (not filter-based) guarantee against cross-visibility leaks (ADR 0008) |

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
