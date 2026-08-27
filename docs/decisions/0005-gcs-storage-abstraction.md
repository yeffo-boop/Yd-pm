# ADR 0005: Storage abstraction over Google Cloud Storage, signed URLs, fake adapter for tests

## Status
Proposed (Phase 0)

## Context
The spec requires GCS for uploaded files from the start, with a storage
abstraction (so the implementation isn't hard-wired to GCS), private
objects only, no committed service-account key, short-lived signed
URLs, non-guessable object keys, DB-authorization-before-access, a cleanup
strategy for failed uploads, configurable limits, and tests using a fake
adapter rather than real GCS.

## Decision
- Define a `StorageProvider` port (`src/server/ports/storage.ts`):
  `createUploadTarget(params): { uploadUrl, objectKey, expiresAt }`,
  `createDownloadUrl(objectKey): { url, expiresAt }`,
  `deleteObject(objectKey): void`.
- Implement `storage-gcs` using `@google-cloud/storage`'s signed-URL
  support (v4 signing), private bucket, object keys as server-generated
  UUIDs under a prefix (e.g., `projects/{projectId}/{uuid}`) — the prefix
  aids operational reconciliation/listing, the UUID prevents the object
  key from ever encoding or leaking the original filename.
- Implement `storage-fake` as an in-memory adapter (Map-backed) for unit/
  integration tests — no network calls, deterministic, fast.
- Production authentication to GCS: **Application Default Credentials**
  via a mounted service-account key file path (or workload identity if the
  VPS setup later supports it) referenced by an environment variable
  pointing to the file's path — the key file itself is a deployment-time
  secret delivered out-of-band (documented in `docs/deployment.md`), never
  committed to the repository or baked into the Docker image.
- Local development: either a real (free-tier) GCS bucket with a
  developer's own credentials, or the fake adapter — documented as a
  choice in `docs/architecture.md`/README once Phase 1 sets up the dev
  environment.
- Every `createUploadTarget`/`createDownloadUrl` call re-checks the
  caller's authorization against the current database state immediately
  before issuing the URL — the signed URL itself carries no authorization
  semantics beyond "can read/write this one object for a few minutes."
- Cleanup/reconciliation: a scheduled pg-boss job (`file-upload-reconcile`)
  finds `FileVersion` rows whose upload was never confirmed past a
  timeout, and GCS objects with no matching non-deleted DB row, and removes
  the orphans — soft-deleted `FileVersion` rows are retained for a
  documented grace period before their objects are actually deleted, so an
  accidental delete stays recoverable for a while.

## Consequences
- Swapping to S3-compatible storage later (e.g., if hosting economics
  change) means writing one more adapter behind the same port — no domain
  code changes.
- Tests never depend on network access or a live GCP project.

## Alternatives considered
- **Local disk storage on the VPS** — rejected as the primary store; no
  redundancy, complicates backup story, and the spec explicitly specifies
  GCS.
- **Public GCS objects with obscure URLs** — rejected outright; violates
  "private objects" requirement and is trivially wrong for client-
  confidential project files.
