# YeffoHub — Security Model & Threat Notes (Phase 0)

Status: initial threat model, written before any code exists. Expanded with
concrete findings and a completed checklist in Phase 8 (production
hardening); each earlier phase adds the controls relevant to what it builds.
This document makes no compliance claims (no SOC 2, PCI, HIPAA, etc.) — it
states what is and is not protected, honestly, at MVP scope.

## 1. Threat model: client/tenant isolation

**Assets:** project content, files, comments, schedule data, contact info —
per `ClientCompany`.

**Adversary:** an authenticated `CLIENT` user of Company A, attempting to
read or modify Company B's data, either by guessing/enumerating IDs, replaying
a URL seen elsewhere, or calling a server action/API route directly with a
crafted payload (bypassing the UI entirely).

**Controls:**

- Deny-by-default: every client-scoped repository query is pre-scoped to
  the caller's authorized project set (`docs/permissions.md` §2), computed
  server-side from the session, every time — not cached across requests,
  not trusted from a client-supplied field.
- UUID identifiers are not sequential/guessable, but **obscurity is not the
  control** — the authorization check is what matters; UUIDs only remove
  trivial enumeration as a distraction vector.
- A resource that exists but isn't authorized returns the same 404 as a
  resource that doesn't exist, for pages, server actions, and API routes
  alike (no existence oracle).
- Cross-client authorization tests (per `docs/permissions.md` §6) are a
  required quality gate from Phase 1 onward, run against the real DB.
- Search, notifications, exports, and activity feeds are built from the
  same pre-scoped queries as direct access (§2 of permissions doc) — a
  common real-world leak vector is a "convenience" endpoint (autocomplete,
  export, digest email) that skips the main authorization path; YeffoHub
  has no such second path by construction.

**Residual risk:** a future feature that adds a new query path (e.g., a
new report) must reuse the scoped repository layer; this is a process
control (code review against this document), not something the framework
can fully guarantee automatically.

## 2. Threat model: authentication & account lifecycle

**Adversary:** unauthenticated attacker attempting credential stuffing,
brute force, session fixation/hijack, or account enumeration; or a former
client contact whose access should have been revoked.

**Controls:**

- Passwords hashed with Argon2id (memory/time cost tuned in Phase 1 to a
  documented, benchmarked target — not left at library defaults
  unexamined).
- Generic error messages on login/reset ("invalid email or password" /
  "if that address exists, a reset email was sent") — never confirms
  whether an account exists.
- Rate limiting on login, password reset request, invitation redemption,
  and registration-adjacent endpoints, keyed by IP and by account, with
  backoff — implemented in Phase 1 using a Postgres-backed counter (no new
  infra) rather than an in-memory limiter that resets on every deploy/
  restart or doesn't work across multiple app instances.
- Session strategy is JWT-based (Auth.js's Credentials provider does not
  support its database session strategy — see ADR 0003), but every request
  re-checks the signing user's current `tokenVersion` and `status` against
  Postgres inside the `jwt` callback before trusting the token; changing a
  password or disabling an account bumps `tokenVersion` in the same
  transaction as that write, so a stale token is rejected on its very next
  use, not merely at its natural expiry.
- Invitation and password-reset tokens: single-use, time-limited, stored
  **hashed** (never the raw token) so a database read alone can't be used
  to forge a valid link; the raw token exists only in the emailed URL and
  briefly in server memory when generated/validated.
- No hard-coded credentials anywhere in the repo or images; the initial
  owner/admin account is created by a documented bootstrap procedure
  (Phase 1) that requires either an interactive prompt or a one-time
  environment-provided secret consumed on first run and then invalidated
  — never a checked-in default password.

**Residual risk / explicitly deferred:** no multi-factor authentication in
v1 (not in the spec's MVP scope); no anomaly/impossible-travel detection.
Documented as a gap, not silently absent.

## 3. Threat model: invitations

**Adversary:** attacker who intercepts or guesses an invitation link, or a
former contact whose invitation was never redeemed.

**Controls:** single-use (redemption atomically marks the token used inside
the same transaction that creates the session, preventing a race where two
concurrent requests both redeem it), short expiry (default documented in
Phase 2, owner-configurable), tokens are high-entropy random values (not
derived from guessable data like email+timestamp), hashed at rest, and an
expired/used token shows a distinct, non-revealing "this invitation is no
longer valid" state rather than a generic error that might hint at internal
state.

## 4. Threat model: file access (Google Cloud Storage)

**Adversary:** a client attempting to access another client's file by
guessing/reusing a storage URL, uploading a disguised file to exploit a
downstream viewer, or exploiting a signed-URL flow to get access beyond
what was authorized.

**Controls:**

- Bucket is **private**; objects are never public, there is no public
  bucket ACL or public object ACL path in the codebase.
- Object keys are server-generated opaque UUIDs — never the client's
  filename, never derived from predictable data — so a leaked key alone
  reveals nothing about the file, and there is no path-traversal surface
  because the "path" is never built from user input.
- Signed URLs are short-lived and scope-specific (upload vs. download),
  issued only after a fresh authorization check against current DB state
  at issuance time — not reused across requests or cached client-side
  beyond their natural expiry.
- Server-side validation of file size and MIME type against a configurable
  allow-list happens **before** a signed upload URL is even issued (via
  GCS signed-URL policy constraints) and is re-validated against the
  actual uploaded object's reported content type once the upload completes
  and the app is notified, since a client can lie about MIME type in the
  upload request; the original filename is sanitized for **display**
  (stripped of control characters/path separators) and is never used to
  construct a storage path.
- Deletions are soft (the DB row is marked deleted; the GCS object is
  retained until a documented reconciliation job removes genuinely orphaned
  objects), so an accidental delete is recoverable and so a delete action
  is itself logged (`AuditLog`) before any object is actually removed.
- Security-relevant file actions (upload, replace, delete, download) are
  written to `AuditLog` with actor, object, and timestamp — not the file's
  contents.

**Residual risk:** GCS billing/quota exhaustion is an availability risk,
not a confidentiality one; monitoring guidance lands in Phase 8.

## 5. Threat model: staging links & SSRF

Staging-site URLs are **stored and linked**, never fetched server-side for
preview/screenshot purposes in the MVP — this sidesteps SSRF entirely for
v1. If a future phase adds server-side link previews, it must go through a
documented allow-list + redirect-blocking fetcher, never a raw
`fetch(userSuppliedUrl)`. What Phase 6 _does_ validate server-side: the
staging URL's **protocol** must be `https:` (or `http:` only if explicitly
allowed) before it is stored or ever rendered as a clickable link, so a
`javascript:` or other unsafe scheme can never be persisted or opened.

## 6. Threat model: future WordPress/WooCommerce integration

Detailed in `docs/integrations/woocommerce-future.md`. Summary of the
security posture that document commits to: signed webhooks (HMAC over the
raw request body, verified before any parsing), a timestamp + nonce/replay
window, secret rotation support, "never trust order data merely because it
arrived at the webhook endpoint" (full schema validation, referential
sanity checks, no direct trust of amounts/status for anything financial
since YeffoHub does no invoicing), an event inbox with dead-lettering
instead of silently dropping malformed events, and no shared password
storage between WordPress and YeffoHub for the future SSO direction
(standards-based OAuth2/OIDC or a signed-token broker only).

## 7. Threat model: future WordPress SSO

Not built in the MVP. The identity-provider boundary (`AuthService`
interface, §Architecture) is designed so a future SSO provider is an
additional adapter, not a rewrite of the Credentials-based flow. Design
commitment: OAuth 2.0/OIDC (or an equivalent signed-token broker reviewed
before implementation) — never a shared password table, never trusting a
WordPress-asserted email without signature verification against a known
key.

## 8. Application-layer security controls (all phases)

- **CSRF:** Next.js Server Actions include built-in CSRF protection
  (origin-checked POSTs); any REST-style route handler that performs a
  mutation additionally verifies a same-site/CSRF token or is restricted to
  a signed-webhook trust model (future integration only) rather than
  browser-originated cookies.
- **Cookies:** `Secure`, `HttpOnly`, `SameSite=Lax` (or `Strict` where it
  doesn't break the invitation-link flow) session cookies; verified in
  Phase 1 and re-checked in Phase 8 alongside production security headers
  (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS once HTTPS is confirmed).
- **Rate limiting:** login, password reset, invitation redemption,
  comments, uploads, and other sensitive mutation endpoints — a shared
  Postgres-backed limiter utility, not a bespoke check per route.
- **Input validation:** zod schemas at every trust boundary (form submit,
  server action, route handler, job payload), shared between client and
  server so validation logic is never duplicated or allowed to drift.
- **Output rendering:** React's default escaping handles the common case;
  any place that must render user-authored rich text is explicitly
  reviewed and sanitized (allow-list based), never `dangerouslySetInnerHTML`
  on unsanitized input.
- **Database access:** exclusively through Prisma's parameterized query
  builder; no raw SQL string concatenation with user input anywhere in the
  codebase (a raw `$queryRaw` with `Prisma.sql` tagged parameters is
  acceptable when needed for a search/index feature, string concatenation
  is not).
- **Secrets:** environment variables in development; `.env.example` lists
  variable **names** only, no values, with inline comments on what each is
  for and where to obtain it. If a later phase's UI lets the owner enter
  SMTP/integration secrets, they are encrypted at rest with a server-side
  master key (`ENCRYPTION_MASTER_KEY`, env-provided, never in the repo or
  database) and the stored value is never returned to the browser — only a
  "configured / not configured" status and a "test connection" action that
  runs server-side.
- **Logging:** structured logs redact known-sensitive field names
  (password, token, secret, authorization header, SMTP credentials) at the
  logging utility level, not left to each call site to remember.
- **Transactions:** proposal conversion, cascading date shifts, approval
  recording, and recurring-maintenance generation are each a single DB
  transaction — partial application of a multi-record business operation
  is treated as a correctness bug, not an acceptable edge case.
- **Dependency hygiene:** `npm audit` (or equivalent) runs in CI; a
  documented update procedure (`docs/deployment.md`, Phase 8) covers how
  and how often dependencies are reviewed and bumped.

## 9. Explicitly not protected against (honesty over false assurance)

- No WAF/DDoS mitigation beyond what the reverse proxy and rate limiting
  provide — appropriate to a small self-hosted app, not internet-scale
  traffic.
- No client-side device compromise protection (malware/keylogger on a
  client's machine is out of scope, as with essentially all web apps).
- No legal-grade electronic signature for approvals — stated plainly in
  the UI copy for every approval action, so it is never mistaken for one.
- No credential vault for hosting/domain passwords in v1 — the
  questionnaire flow explicitly directs the owner/client to exchange such
  credentials outside YeffoHub (e.g., a password manager's secure share
  link) until a dedicated, reviewed secret-handling feature exists.
