# ADR 0003: Auth.js v5 (Credentials, JWT + server-checked token version) with Argon2id

## Status

Accepted, revised during Phase 1 implementation — see "Revision" below.

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
  floating range), with a single **Credentials** provider backing
  email/password. No adapter is configured — we have no OAuth providers
  and no magic-link email sign-in, so there is nothing for an adapter to
  persist that our own `User` table (checked directly inside the
  `authorize()` callback) doesn't already cover; this also drops
  `@auth/prisma-adapter` as a dependency entirely.
- **JWT session strategy with a server-checked token version**, not
  Auth.js's database session strategy — see "Revision" below for why.
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

## Revision (Phase 1 implementation)

Phase 0 specified Auth.js's **database** session strategy specifically to
get immediate session invalidation on password change/disable. During
Phase 1 implementation this turned out to be unbuildable as planned: Auth.js
v5's Credentials provider does not support the database session strategy —
this is a documented, longstanding upstream limitation (the adapter's
`getSessionAndUser` path is never exercised for credentials-based sign-in,
so the session lookup returns `null`). This is exactly the kind of
compatibility fact Phase 0 aimed to catch, just surfaced one phase later
than ideal because it only became visible when wiring real code against the
real library, not from reading version numbers.

**Replacement design**, which preserves the actual requirement (a disabled
account or a changed password stops working on the very next request) without
database sessions:

- `User.tokenVersion Int @default(0)`.
- The Auth.js `jwt` callback embeds `userId`, `role`, and the `tokenVersion`
  that was current at sign-in into the token.
- Every request that resolves a session (via `auth()`, middleware, or a
  server action) re-reads the user's **current** `tokenVersion` and
  `status` from Postgres inside the `jwt` callback and compares them to the
  token's claims; a mismatch (version bumped, or `status = DISABLED`)
  makes the callback return `null`, which Auth.js treats as an invalid
  session — the caller is signed out on that request, not merely on next
  token refresh.
- Changing a password or disabling a user increments `tokenVersion` inside
  the same transaction as that write, so there is no window where a stale
  token remains valid after the action that was supposed to invalidate it.
- This is a per-request database read (one indexed lookup by primary key),
  the same cost a database-session lookup would have had — so there is no
  performance difference from the originally planned approach, only a
  different mechanism for the invalidation check.

## Consequences

- `next-auth@5.0.0-beta.32`'s `nodemailer` peer range (`^7.0.7 || ^8.0.5`)
  predates the patched `nodemailer@9.0.1+` release (GHSA-p6gq-j5cr-w38f, a
  high-severity SSRF/arbitrary-file-read issue in the `raw` message option,
  fixed in 9.0.1). We do not use Auth.js's optional email/magic-link
  provider (Credentials only), so this peer relationship is inert at
  runtime; `package.json` pins `nodemailer@9.0.6` directly (the patched
  version, used by our own `MailProvider` adapter) via an `overrides` entry
  so npm's install resolves one consistent version tree instead of the
  vulnerable transitive one. `npm install` prints a peer-dependency warning
  for this, which is expected and does not indicate a runtime conflict.
- Accepted risk: depending on a library still tagged beta. Mitigated by
  pinning an exact version, isolating it behind an interface, and
  reviewing its changelog at every phase checkpoint that touches auth.
- Token-version lookups hit Postgres on every request — acceptable at this
  scale (~dozens of concurrent users, not thousands), and no costlier than
  the database-session lookup originally planned.
- The `AuthService` boundary is what makes the future WordPress SSO
  addition (ADR-to-be-written when that phase starts) an additive change:
  a new adapter implementing the same interface, not a rewrite. A future
  SSO/OAuth provider would introduce the first real use for an adapter and
  can add one (or its own persistence) without disturbing the Credentials
  path.

## Alternatives considered

- **Lucia** — discontinued as an actively maintained library; rejected.
- **Custom session implementation from scratch** — rejected as unnecessary
  risk/effort; Auth.js's cookie/CSRF handling is a solved, reviewed
  problem even in its beta channel.
- **Plain JWT-only sessions with no server-side check** — rejected on its
  own; a signature-valid JWT would keep working until its natural expiry
  even after a password change, which fails the spec's invalidation
  requirement outright.
- **A hand-rolled database-session layer that bypasses Auth.js's session
  handling** (custom cookie + session table, using Auth.js only for
  provider/CSRF plumbing) — considered as a closer match to true DB
  sessions, rejected as more custom code fighting the library's documented
  behavior instead of working with it, for a security-critical path where
  boring and well-understood beats clever.
