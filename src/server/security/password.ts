import * as argon2 from "argon2";

/**
 * Argon2id parameters, set explicitly rather than left at library defaults
 * (docs/security.md §2). These match the "strong" tier of OWASP's Password
 * Storage Cheat Sheet guidance (m=64 MiB, t=3, p=4) — a deliberate choice
 * given this app has a small user base and login latency on the target
 * VPS's hardware matters more than squeezing out the lightest OWASP
 * minimum. Revisit if VPS-measured login latency proves uncomfortable.
 */
const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return argon2.hash(plainTextPassword, ARGON2ID_OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  candidatePassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, candidatePassword);
  } catch {
    // A malformed/foreign hash format throws rather than returning false;
    // treat that the same as "does not match" instead of leaking the
    // distinction to the caller.
    return false;
  }
}
