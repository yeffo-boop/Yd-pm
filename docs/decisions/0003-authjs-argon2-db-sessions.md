# ADR 0003: Auth.js v5 (Credentials + Prisma adapter, DB sessions) with Argon2id

## Status
Proposed (Phase 0)

## Context
The spec requires email/password authentication, Argon2id hashing "when
compatible with the selected runtime," secure invitations and password
resets, session invalidation after password change/disable, and an
isolated identity-provider boundary for a future WordPress SSO. Auth.js
(NextAuth) v5 is the standard self-hosted auth library for Next.js App
Router but has remained on `5.0.0-beta.x` version tags well past its
de facto production adoption; competing self-hosted options (e.g., Lucia)
have been discontinued as maintained libraries, and rolling a fully custom
session/cookie implementation would mean re-solving problems Auth.js has
already solved (CSRF-safe cookie handling, adapter interface, provider
abstraction).

Because this app runs on a self-hosted Node.js runtime (ADR 0001), the
`argon2` native module is usable without the restrictions that block it on
serverless/Edge platforms.

## Decision
- Auth.js v5, pinned to an exact `next-auth@5.0.0-beta.3x` version (not a
  floating range), with the Prisma adapter and a single **Credentials**
  provider backing email/password.
- **Database session strategy** (not JWT-only) — required so that changing
  a password or disabling a user deletes their sessions immediately, per
  spec.
- Password hashing: `argon2` (node-argon2 native binding), Argon2id
  variant, with cost parameters benchmarked and documented at Phase 1
  implementation time (target: comfortably resistant to offline attack
  while keeping login latency low on the target VPS's hardware).
- All Auth.js-specific wiring lives behind an `AuthService` interface in
  `src/server/ports` / `src/server/adapters/auth-authjs`; nothing else in
  the codebase imports `next-auth` directly.
- Invitation and password-reset tokens are a custom-built flow (not an
  Auth.js built-in), stored hashed, single-use, time-limited, per
  `docs/security.md` §2–3.

## Consequences
- Accepted risk: depending on a library still tagged beta. Mitigated by
  pinning an exact version, isolating it behind an interface, and
  reviewing its changelog at every phase checkpoint that touches auth.
- DB session strategy means session lookups hit Postgres — acceptable at
  this scale (~dozens of concurrent users, not thousands).
- The `AuthService` boundary is what makes the future WordPress SSO
  addition (ADR-to-be-written when that phase starts) an additive change:
  a new adapter implementing the same interface, not a rewrite.

## Alternatives considered
- **Lucia** — discontinued as an actively maintained library; rejected.
- **Custom session implementation from scratch** — rejected as unnecessary
  risk/effort; Auth.js's cookie/CSRF handling is a solved, reviewed
  problem even in its beta channel.
- **JWT-only sessions** — rejected; cannot satisfy "session invalidation
  after password change" without a separate revocation-list mechanism that
  ends up reimplementing what DB sessions already give for free.
