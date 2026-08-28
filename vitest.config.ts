import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const srcAlias = path.resolve(import.meta.dirname, "./src");

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias: { "@": srcAlias } },
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/unit/setup.ts"],
        },
      },
      {
        resolve: { alias: { "@": srcAlias } },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./tests/integration/setup.ts"],
          // Integration tests share one Postgres database and reset state
          // between files; running them concurrently would race on that
          // shared state, so each file runs to completion before the next.
          fileParallelism: false,
        },
      },
    ],
  },
});
