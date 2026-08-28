import { config } from "dotenv";

config({ path: ".env.test" });

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error(
    "E2E tests require DATABASE_URL to point at a database whose name " +
      'contains "_test" — refusing to run against a non-test database.',
  );
}

export default async function globalSetup(): Promise<void> {
  // Reuse the exact same fixtures the deterministic dev seed produces, so
  // e2e specs can log in as the documented seed accounts (owner, Aurora
  // Bakery's primary/additional contacts, Northwind Fitness's primary
  // contact) with well-known credentials.
  const { resetDatabase } = await import("../integration/helpers");
  await resetDatabase();
  await import("../../prisma/seed");
}
