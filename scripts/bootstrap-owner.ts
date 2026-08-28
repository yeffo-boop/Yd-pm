/**
 * Creates the first OWNER account. This is the only supported way to get
 * an initial admin into a fresh YeffoHub database — there is no hard-coded
 * credential anywhere in the repository or the Docker image, and this
 * script refuses to run more than once (docs/security.md §2).
 *
 * Usage (local or via `docker compose run --rm app npx tsx scripts/bootstrap-owner.ts`):
 *
 *   1. Set OWNER_BOOTSTRAP_EMAIL and OWNER_BOOTSTRAP_PASSWORD in the
 *      environment (NOT committed anywhere — pass them as one-time shell
 *      env vars or a deployment secret, not a checked-in .env file).
 *   2. Run: npm run bootstrap:owner
 *   3. Unset/remove OWNER_BOOTSTRAP_EMAIL and OWNER_BOOTSTRAP_PASSWORD
 *      immediately afterward. The script does not persist them anywhere
 *      itself, but they should not linger in shell history or a process
 *      manager's stored environment longer than necessary.
 *
 * The script exits non-zero and creates nothing if an OWNER already
 * exists — re-running it is always safe.
 */
import "dotenv/config";
import { z } from "zod";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/security/password";

const bootstrapSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Argon2id (see src/server/security/password.ts) makes offline brute
  // force expensive regardless of length beyond a point, but a length
  // floor is still the cheapest defense against a weak/guessable value
  // for an account with full OWNER privileges.
  password: z.string().min(12, "Password must be at least 12 characters."),
});

async function main(): Promise<void> {
  const existingOwner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (existingOwner) {
    console.error(
      "Refusing to bootstrap: an OWNER account already exists " +
        `(${existingOwner.email}). This script only creates the first owner.`,
    );
    process.exitCode = 1;
    return;
  }

  const parsed = bootstrapSchema.safeParse({
    email: process.env.OWNER_BOOTSTRAP_EMAIL,
    password: process.env.OWNER_BOOTSTRAP_PASSWORD,
  });

  if (!parsed.success) {
    console.error(
      "OWNER_BOOTSTRAP_EMAIL and OWNER_BOOTSTRAP_PASSWORD must both be set " +
        "to valid values before running this script:\n" +
        parsed.error.issues.map((issue) => `  - ${issue.message}`).join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const { email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const owner = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: "OWNER",
        name: "Owner",
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: created.id,
        action: "OWNER_BOOTSTRAPPED",
        entityType: "User",
        entityId: created.id,
      },
    });
    return created;
  });

  console.log(`OWNER account created: ${owner.email}`);
  console.log(
    "Now unset OWNER_BOOTSTRAP_EMAIL and OWNER_BOOTSTRAP_PASSWORD wherever they were set.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("Bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
