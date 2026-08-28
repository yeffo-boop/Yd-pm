import { prisma } from "@/server/db";

/**
 * Wipes every application table between tests. Safe by construction: the
 * setup file (tests/integration/setup.ts) refuses to load unless
 * DATABASE_URL names a "_test" database, so this can never run against dev
 * or production data.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ProjectMembership",
      "Project",
      "ClientContact",
      "ClientCompany",
      "AuditLog",
      "RateLimitBucket",
      "User"
    RESTART IDENTITY CASCADE;
  `);
}
