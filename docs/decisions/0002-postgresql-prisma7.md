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

## Revision (Phase 1 implementation)

Prisma 7 turned out to be a bigger jump than a routine minor-version bump:
it removes the bundled Rust query engine by default ("Rust-free Prisma
Client"). Two concrete effects, discovered by running `prisma validate`
against a schema written the Prisma 5/6 way and reading the error it
raised, not assumed in advance:

- The classic `datasource db { url = env("DATABASE_URL") }` field is no
  longer accepted in `schema.prisma`. The connection URL for CLI commands
  (`migrate`, `studio`, etc.) now lives in `prisma.config.ts`'s
  `datasource.url`, loaded via `dotenv/config` at the top of that file.
- `new PrismaClient()` with no arguments now throws — the client requires
  an explicit **driver adapter**. For Postgres this is `@prisma/adapter-pg`
  (wrapping the `pg` driver): `new PrismaClient({ adapter: new PrismaPg({
connectionString: process.env.DATABASE_URL }) })`, constructed once in
  `src/server/db.ts` and reused as a singleton (see that file for the
  Next.js dev-hot-reload-safe singleton pattern).

Both `@prisma/adapter-pg` and `pg` (+ `@types/pg`) are added as
dependencies, pinned to versions verified compatible with
`@prisma/client@7.10.0` (`@prisma/adapter-pg` is released in lockstep with
`@prisma/client`, same version number).

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
