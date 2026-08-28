import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma 7 dropped the bundled Rust query engine — PrismaClient now
 * requires an explicit driver adapter. See docs/decisions/0002-postgresql-prisma7.md
 * ("Revision") for why this differs from the classic `new PrismaClient()`
 * pattern used in earlier Prisma versions.
 *
 * The singleton-on-globalThis pattern avoids exhausting Postgres
 * connections during Next.js dev's hot module reload, which would
 * otherwise re-run this module (and open a fresh connection pool) on
 * every edit.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
