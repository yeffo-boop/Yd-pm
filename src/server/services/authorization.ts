import { prisma } from "@/server/db";

/**
 * The authenticated identity a request is acting as, derived server-side
 * from the session — never from a client-supplied field (docs/permissions.md
 * §2, §5). `CLIENT` identities carry enough of their `ClientContact` row to
 * compute an authorized-project scope without a second query on every call.
 */
export type Identity =
  | { role: "OWNER"; userId: string }
  | {
      role: "CLIENT";
      userId: string;
      clientContactId: string;
      clientCompanyId: string;
      isPrimary: boolean;
    };

/**
 * Thrown when an authenticated identity requests a resource it is not
 * authorized to see. Route handlers/server actions must map this to a
 * plain 404 — the same response a nonexistent ID would produce — never a
 * 403 or any response that confirms the resource exists (docs/permissions.md
 * §2). Deliberately not a subclass of a generic "not found" error so the
 * two cases can still be told apart in logs/audit trails while producing
 * an identical HTTP response.
 */
export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Resolves the full `Identity` for a signed-in user id. Returns `null` for
 * a user id that doesn't resolve to an active account (deleted user, or a
 * CLIENT role user somehow missing its ClientContact row) — callers treat
 * `null` as "not authenticated" rather than throwing, since this can
 * legitimately happen for a stale/invalidated token racing a disable.
 */
export async function loadIdentity(userId: string): Promise<Identity | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { clientContact: true },
  });

  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    return null;
  }

  if (user.role === "OWNER") {
    return { role: "OWNER", userId: user.id };
  }

  const contact = user.clientContact;
  if (!contact || contact.deletedAt) {
    return null;
  }

  return {
    role: "CLIENT",
    userId: user.id,
    clientContactId: contact.id,
    clientCompanyId: contact.clientCompanyId,
    isPrimary: contact.isPrimary,
  };
}

export type ProjectScope = { all: true } | { all: false; projectIds: string[] };

/**
 * The set of project ids a CLIENT identity may access: every non-deleted
 * project at their company if they are the primary contact (implicit
 * access, never materialized as membership rows — docs/data-model.md §1),
 * plus any project they hold an explicit `ProjectMembership` grant for.
 * OWNER gets the `{ all: true }` sentinel rather than an enumerated list.
 */
export async function getAuthorizedProjectScope(
  identity: Identity,
): Promise<ProjectScope> {
  if (identity.role === "OWNER") {
    return { all: true };
  }

  const [companyProjects, memberships] = await Promise.all([
    identity.isPrimary
      ? prisma.project.findMany({
          where: { clientCompanyId: identity.clientCompanyId, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.projectMembership.findMany({
      where: { clientContactId: identity.clientContactId },
      select: { projectId: true },
    }),
  ]);

  const projectIds = new Set<string>();
  for (const project of companyProjects) projectIds.add(project.id);
  for (const membership of memberships) projectIds.add(membership.projectId);

  return { all: false, projectIds: [...projectIds] };
}

/**
 * Throws `AuthorizationError` unless `identity` is OWNER. Use at the top
 * of every owner-only service function.
 */
export function assertOwner(
  identity: Identity,
): asserts identity is { role: "OWNER"; userId: string } {
  if (identity.role !== "OWNER") {
    throw new AuthorizationError("Owner access required");
  }
}
