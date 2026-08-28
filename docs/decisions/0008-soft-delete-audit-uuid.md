# ADR 0008: UUID primary keys, soft deletion for business records, dual-audit-trail (system audit log + client activity log + shared activity feed)

## Status

Proposed (Phase 0)

## Context

The spec asks for UUIDs unless there's a strong documented reason
otherwise, soft deletion/recovery for important business records,
auditability throughout, and three distinct audit/activity surfaces with
different visibility: an owner-only system/security audit log, an
owner-only client-activity log, and a client-facing shared activity feed
that must only ever contain published events.

## Decision

- **UUID primary keys** everywhere (exact v4 vs. v7 decided at Phase 1
  implementation based on final Prisma/Postgres version support for
  time-ordered generation; either satisfies "non-guessable, non-
  sequential," which is the property that matters for security). No
  strong reason found to deviate to auto-increment integers anywhere in
  this domain.
- **Soft deletion** (`deletedAt` timestamp) on business records an owner
  could plausibly want to recover: `Project`, `ClientCompany`,
  `ClientContact`, `FileAsset` (its `FileVersion`s are never deleted,
  only superseded), `User`. Purely derived/log-like rows (audit log
  entries, notification recipients, date-change history) are append-only
  and never deleted at all, by design — there is nothing to "recover"
  for a log entry, and retaining them is the point.
- **Three separate tables**, not one filtered by an access-control column,
  for the three audit/activity surfaces (`AuditLog`, `ClientActivityLog`,
  `SharedActivityEvent` — `docs/data-model.md` §12). Each is written to
  explicitly by the service-layer code path that already knows the
  correct visibility for that event, rather than derived by filtering a
  single unified log at read time.

## Consequences

- UUIDs cost a small amount of index size/readability versus integers;
  acceptable given the security property they provide (matches spec intent
  even though authorization, not ID obscurity, is the real control — see
  `docs/security.md` §1).
- Soft-deleted records need consistent handling in every query (`WHERE
deletedAt IS NULL` applied by the repository layer by default, not
  ad hoc per call site) — this is a repository-layer discipline documented
  here so it's caught in review if a new query forgets it.
- Three audit tables means slightly more write-side code (an event may be
  logged to more than one) but makes the visibility guarantee structural:
  there is no risk of a future access-control bug in a shared log's filter
  logic ever exposing an internal event to a client, because the client-
  facing table simply never receives internal events in the first place.

## Alternatives considered

- **Single unified `Event` table with a `visibility` column** — rejected;
  the spec is explicit that draft/internal data must not leak through any
  surface including activity feeds, and a single filtered table makes that
  guarantee dependent on every read query getting the filter right forever.
  Separate tables make the wrong-audience case structurally impossible
  rather than merely policy-enforced.
- **Hard delete with a recycle-bin table** — rejected as more moving parts
  than a `deletedAt` column for no added benefit at this scale.
