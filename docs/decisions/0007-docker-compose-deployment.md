# ADR 0007: Docker Compose deployment, multi-stage non-root Dockerfile, Caddy reverse proxy example

## Status
Proposed (Phase 0)

## Context
Target production environment is a Linux VPS without Docker currently
installed; the spec requires Docker Compose for both local and production
use, a multi-stage production Dockerfile running as a non-root user,
health/readiness endpoints, persistent DB volumes, and a reverse-proxy/
HTTPS example.

## Decision
- `compose.yaml` defines: `app` (Next.js web process), `worker` (pg-boss
  job worker, same image, different command), `db` (Postgres, named
  volume for persistence). A `compose.override.yaml`-style pattern (or
  documented profiles) separates local-dev conveniences (bind mounts, dev
  SMTP capture container) from the production-safe configuration.
- Production `Dockerfile` is multi-stage: a build stage installs
  dependencies and compiles, a slim runtime stage copies only the built
  output and production dependencies and runs as a dedicated non-root user
  (`node` user or an explicitly created `app` user).
- `/api/health` (liveness: process is up) and `/api/ready` (readiness:
  can reach the database) are implemented with no secret values or stack
  traces in their responses, suitable for both Docker healthchecks and a
  future uptime monitor.
- Reverse proxy: a documented Caddy example (automatic HTTPS via Let's
  Encrypt, minimal config) as the primary recommendation, with an Nginx
  example provided as an alternative for operators who prefer it.
- Docker Engine + Compose plugin installation instructions are provided
  for common Linux distributions, explicitly flagged as varying by
  distribution rather than assumed.

## Consequences
- Identical container images run in local dev and production, reducing
  "works on my machine" drift.
- Zero/low-downtime deploys and rollback are handled at the Compose level
  (documented procedure in `docs/deployment.md`, Phase 8) rather than
  requiring an orchestrator (Kubernetes) that would be disproportionate to
  a single-VPS, ~25-project-scale deployment.

## Alternatives considered
- **Kubernetes / managed container platform** — rejected as disproportionate
  infrastructure for this scale (spec §17 explicitly warns against this).
- **PaaS (Render, Railway, Fly.io, etc.)** — would simplify ops but
  conflicts with the explicit "Linux VPS, no Docker yet, self-hosted"
  target and would reduce control over the free-tier cost goal.
