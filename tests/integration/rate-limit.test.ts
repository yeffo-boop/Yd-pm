import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit } from "@/server/security/rate-limit";
import { resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

describe("checkRateLimit", () => {
  it("allows requests under the limit and reports remaining budget", async () => {
    const policy = { windowSeconds: 60, max: 3 };
    const first = await checkRateLimit("test-scope", "key-a", policy);
    const second = await checkRateLimit("test-scope", "key-a", policy);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks once the max is exceeded within the window", async () => {
    const policy = { windowSeconds: 60, max: 2 };
    await checkRateLimit("test-scope", "key-b", policy);
    await checkRateLimit("test-scope", "key-b", policy);
    const third = await checkRateLimit("test-scope", "key-b", policy);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("keeps independent counters per key", async () => {
    const policy = { windowSeconds: 60, max: 1 };
    await checkRateLimit("test-scope", "key-c1", policy);
    const otherKey = await checkRateLimit("test-scope", "key-c2", policy);

    expect(otherKey.allowed).toBe(true);
  });

  it("keeps independent counters per scope for the same key", async () => {
    const policy = { windowSeconds: 60, max: 1 };
    await checkRateLimit("scope-1", "same-key", policy);
    const otherScope = await checkRateLimit("scope-2", "same-key", policy);

    expect(otherScope.allowed).toBe(true);
  });

  it("survives concurrent hits without under-counting", async () => {
    const policy = { windowSeconds: 60, max: 100 };
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        checkRateLimit("test-scope", "concurrent-key", policy),
      ),
    );
    const remainders = results.map((r) => r.remaining).sort((a, b) => a - b);
    // 20 concurrent increments against a max of 100 should yield 20
    // distinct counts (80..99 remaining) if the increment is truly atomic;
    // any duplicate remaining value would indicate a lost update.
    expect(new Set(remainders).size).toBe(20);
  });
});
