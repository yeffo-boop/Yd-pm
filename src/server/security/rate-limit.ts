import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export interface RateLimitPolicy {
  /** Fixed window size in seconds. */
  windowSeconds: number;
  /** Maximum allowed hits within one window. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** ISO timestamp the current window resets at. */
  resetAt: string;
}

/**
 * Postgres-backed fixed-window rate limiter (docs/security.md §8,
 * docs/decisions/0004-pgboss-job-queue.md's sibling rationale: no new
 * infra for a small, self-hosted app). One row per (scope, key, window);
 * the increment is a single atomic `INSERT ... ON CONFLICT DO UPDATE`, so
 * concurrent requests from the same key can never under-count each other
 * the way a check-then-increment pair would under race conditions.
 *
 * `scope` namespaces independent limiters (e.g. "login", "password-reset",
 * "invitation-redeem"); `key` is caller-chosen (an IP address, an account
 * id, or a composite of both) so the same mechanism can rate-limit either
 * axis without new code.
 */
export async function checkRateLimit(
  scope: string,
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const windowMillis = policy.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMillis) * windowMillis);

  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" (id, scope, "bucketKey", "windowStart", count)
    VALUES (gen_random_uuid(), ${scope}, ${key}, ${windowStart}, 1)
    ON CONFLICT (scope, "bucketKey", "windowStart")
    DO UPDATE SET count = "RateLimitBucket".count + 1
    RETURNING count;
  `);

  const count = rows[0]?.count ?? 0;
  const resetAt = new Date(windowStart.getTime() + windowMillis);

  return {
    allowed: count <= policy.max,
    remaining: Math.max(0, policy.max - count),
    resetAt: resetAt.toISOString(),
  };
}
