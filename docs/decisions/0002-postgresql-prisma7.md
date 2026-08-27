# ADR 0002: PostgreSQL + Prisma ORM v7 (not v8), migrations + seed

## Status
Proposed (Phase 0)

## Context
The spec requires PostgreSQL as the primary database, Prisma ORM with
migrations and a deterministic seed script, and a caution to verify
selected versions are mutually compatible and not deprecated. As of this
writing, Prisma 7.x is the current generally-available line; Prisma 8 exists
only as a release candidate (`8.0.0-rc.x`).

## Decision
- PostgreSQL 16.x as the primary datastore (single database — no read
  replicas or sharding at this scale).
- Prisma ORM 7.x (`prisma`, `@prisma/client`) with `prisma/schema.prisma`,
  `prisma/migrations/`, and a deterministic `prisma/seed.ts` (fixed IDs/
  ordering, no randomness in seeded relationships, so re-running against a
  fresh DB is reproducible for tests and demos).
- All multi-record business operations (proposal conversion, cascading
  date shifts, approval recording, recurring-maintenance generation) use
  `prisma.$transaction(...)`.
- Track Prisma 8's GA release as a future, separate upgrade ADR — not
  adopted pre-GA per the spec's "not deprecated / verified compatible"
  requirement, since an RC is by definition not yet stable and its
  ecosystem (adapters, docs) is still catching up.

## Consequences
- One well-documented, typed query layer; migration history is reviewable
  in PRs.
- Revisiting Prisma 8 later means re-running the compatibility check this
  ADR performed, not a silent bump.

## Alternatives considered
- **Drizzle ORM** — lighter weight, SQL-closer, but the spec explicitly
  names Prisma, and Prisma's migration tooling + seed ergonomics fit the
  "deterministic seed script" requirement well out of the box.
- **Raw SQL / query builder only** — rejected; loses generated types and
  the migration-diff safety net the spec's CI gate (migration validation)
  depends on.
