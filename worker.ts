import "dotenv/config";
import { PgBoss } from "pg-boss";

/**
 * Background job worker entrypoint (ADR 0004, ADR 0007). Runs as the same
 * application image as the web process, started with a different command,
 * in its own Compose service — one codebase, one set of domain services,
 * no duplicated logic between web and worker.
 *
 * No job handlers are registered yet. Phase 4 adds the job catalog named
 * in docs/architecture.md §7 (deadline reminders, email delivery) and
 * Phase 7 adds recurring-maintenance generation. This is a real, testable
 * process — it connects, starts pg-boss, and shuts down cleanly — rather
 * than a placeholder that merely looks like one (per the project's working
 * rules on leaving documented, testable interfaces).
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const boss = new PgBoss(connectionString);
  boss.on("error", (error: Error) => {
    console.error("pg-boss error:", error);
  });

  await boss.start();
  console.log("Worker started. No job handlers registered yet (see Phase 4/7).");

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, stopping worker...`);
    await boss.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
