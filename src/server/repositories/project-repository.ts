import type { Prisma, Project } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  getAuthorizedProjectScope,
  type Identity,
} from "@/server/services/authorization";

/**
 * Builds the Prisma `where` fragment for "projects this identity is
 * authorized to see." Every project query in the app is expected to
 * compose with this rather than fetching rows first and checking
 * authorization afterward (docs/permissions.md §2, §5) — that ordering is
 * what makes it structurally impossible for a scoped query to accidentally
 * return another company's project.
 */
async function authorizedProjectWhere(
  identity: Identity,
): Promise<Prisma.ProjectWhereInput> {
  const scope = await getAuthorizedProjectScope(identity);
  const base: Prisma.ProjectWhereInput = { deletedAt: null };

  if (scope.all) {
    return base;
  }

  // A CLIENT identity additionally only ever sees published projects,
  // regardless of membership (docs/permissions.md §4).
  return {
    ...base,
    id: { in: scope.projectIds },
    isPublished: true,
  };
}

/**
 * Returns the project if, and only if, `identity` is authorized to see it.
 * Returns `null` both when the id doesn't exist and when it exists but
 * belongs to another tenant — callers must render both as a plain 404
 * (docs/permissions.md §2), never distinguish them in the response.
 */
export async function findProjectForIdentity(
  identity: Identity,
  projectId: string,
): Promise<Project | null> {
  const where = await authorizedProjectWhere(identity);
  // Combined via `AND`, not object-spread — `{ ...where, id: projectId }`
  // would let this `id` silently overwrite `where.id` (the `{ in:
  // scope.projectIds }` tenant-scoping constraint) whenever both specify
  // the same key, which would authorize *any* project id. This was caught
  // by tests/integration/project-isolation.test.ts.
  return prisma.project.findFirst({ where: { AND: [where, { id: projectId }] } });
}

/** Lists every project `identity` is authorized to see, most recent first. */
export async function listProjectsForIdentity(identity: Identity): Promise<Project[]> {
  const where = await authorizedProjectWhere(identity);
  return prisma.project.findMany({ where, orderBy: { createdAt: "desc" } });
}
