import { config } from "dotenv";

// Loaded before any test file's top-level imports run (Vitest setupFiles
// run first). `.env.test` is a local, uncommitted file pointing at the
// separate `yeffohub_test` database (see docs/testing.md); in CI,
// DATABASE_URL is provided directly by the workflow instead and this is a
// no-op (dotenv silently skips a missing file).
config({ path: ".env.test" });

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error(
    "Integration tests require DATABASE_URL to point at a database whose " +
      'name contains "_test" — refusing to run against what looks like a ' +
      "non-test database. Set DATABASE_URL (or .env.test) accordingly.",
  );
}
