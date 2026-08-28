# ADR 0004: pg-boss (Postgres-backed) for background jobs, not Redis/BullMQ

## Status

Proposed (Phase 0)

## Context

The spec requires a database-backed job queue or robust scheduled-job
strategy for reminders, email delivery, recurring tasks, and retry
handling, explicitly asking for the smallest dependable self-hosted option
with tradeoffs explained. Expected volume at MVP scale (~25 active
projects): deadline reminders, comment/file/approval notification emails,
and recurring-maintenance generation — on the order of tens to low hundreds
of jobs per day, not a high-throughput queue workload.

## Decision

Use `pg-boss`, which implements a job queue on top of PostgreSQL using
`FOR UPDATE SKIP LOCKED` for safe concurrent consumption, running in the
same Postgres instance the app already operates, backs up, and monitors.

## Consequences

- No second stateful service (Redis) to deploy, secure, back up, and
  monitor on a small VPS — directly serves the spec's "smallest dependable
  self-hosted option" instruction.
- A job can be enqueued inside the same Prisma transaction as the business
  write that triggers it (e.g., an approval-request notification job
  enqueued atomically with the `ApprovalRequest` row), which removes a
  whole class of "wrote the record but forgot to notify" bugs.
- Idempotency is layered on top with an explicit `job_dedupe_key` unique
  constraint per job type (ADR rationale: pg-boss's own retry/dedupe
  semantics are a delivery guarantee, not a business-idempotency
  guarantee — the two are handled separately, see `docs/architecture.md`
  §7).
- Ceiling: pg-boss is materially lower-throughput than a Redis-backed
  queue and lacks some of BullMQ's built-in primitives (job flows/DAGs,
  fine-grained rate limiting). Not a concern at 25-project scale; documented
  here as the trigger for revisiting if job volume grows roughly an order
  of magnitude beyond current projections.

## Alternatives considered

- **BullMQ + Redis** — most capable option, rejected for MVP due to the
  added operational surface (a second stateful service) for a workload
  this small; the job-enqueue call sites are wrapped in a thin internal
  interface so swapping the underlying queue implementation later doesn't
  require touching call sites.
- **`node-cron` / bare `setInterval` scheduling with no queue** — rejected;
  doesn't give retry, dedupe, or persistence across restarts, which the
  spec explicitly requires ("robust... retry handling").
- **OS-level cron shelling into a script** — rejected as the sole
  mechanism; still useful later as a trigger for periodic jobs, but the
  actual work still needs to go through pg-boss for retry/idempotency, so
  it doesn't remove the need for a queue.
