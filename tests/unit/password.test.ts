import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/security/password";

describe("password hashing", () => {
  it("hashes with argon2id and round-trips through verifyPassword", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(
      true,
    );
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("returns false instead of throwing for a malformed stored hash", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });

  it("produces a different hash for the same input each time (random salt)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same input"),
      hashPassword("same input"),
    ]);
    expect(a).not.toBe(b);
  });
});
