# ADR 0001: Next.js App Router, TypeScript strict, Node runtime only

## Status

Proposed (Phase 0)

## Context

The spec requires the latest stable Next.js with App Router, TypeScript
strict mode, and a self-hostable deployment to a plain Linux VPS via Docker
Compose — not Vercel. Next.js supports both the Node.js runtime and an Edge
runtime per route; Edge is optimized for Vercel's global edge network and
imposes restrictions (no native Node modules, limited APIs) that matter for
this app's password hashing (argon2, a native addon) and long-lived
Postgres connections.

## Decision

Use Next.js 16.3.x (latest stable at time of writing) with the App Router,
TypeScript 5.9 in `strict` mode, and the **Node.js runtime exclusively** —
no route or middleware opts into the Edge runtime. The app runs as a single
Node process inside Docker, plus a second worker process (same image,
different entrypoint) for background jobs.

## Consequences

- Native modules (argon2) work without special bundling.
- Next.js 16 (verified at Phase 1 implementation) renamed `middleware.ts` to
  `proxy.ts` (exported function `proxy`) and made the Edge runtime
  unavailable there entirely — `proxy` always runs on Node.js. This lines
  up with, rather than works around, this ADR: `src/proxy.ts` calls
  `auth()` directly, which runs our Postgres-backed token-version check
  (ADR 0003) as part of route protection, something that would not have
  been possible under the old Edge-by-default middleware.
- No cold-start/edge geographic-distribution benefits — acceptable, this is
  a single-tenant internal business app on one VPS, not a globally
  distributed consumer product.
- Prisma's connection pooling behaves normally (one long-lived pool per
  process) instead of needing an edge-compatible driver adapter.

## Alternatives considered

- **Edge runtime for some routes** — rejected; the complexity of splitting
  runtime behavior per route isn't justified by any benefit at this scale,
  and it would force a non-native password hashing library.
- **Remix / SvelteKit** — rejected; spec explicitly names Next.js/App
  Router, and Next.js has the deepest self-hosted Docker deployment
  precedent among these.
