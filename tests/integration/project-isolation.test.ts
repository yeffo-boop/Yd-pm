import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { loadIdentity } from "@/server/services/authorization";
import {
  findProjectForIdentity,
  listProjectsForIdentity,
} from "@/server/repositories/project-repository";
import { resetDatabase } from "./helpers";
import {
  createAdditionalContact,
  createClientCompanyWithPrimaryContact,
  createOwner,
  createProject,
} from "./fixtures";

/**
 * The core authorization guarantee from docs/permissions.md §2: a CLIENT
 * of one company can never read another company's project, whether by
 * listing or by guessing/reusing a direct project id — and the negative
 * case must come back exactly like a nonexistent id (`null`), not a
 * different response that would confirm the project exists.
 */
beforeEach(async () => {
  await resetDatabase();
});

describe("cross-tenant project isolation", () => {
  it("lets OWNER see every project across every company", async () => {
    const owner = await createOwner();
    const companyA = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const companyB = await createClientCompanyWithPrimaryContact("Northwind Fitness");
    const projectA = await createProject(
      companyA.company.id,
      companyA.primaryContact.id,
      {
        name: "Aurora Site",
      },
    );
    const projectB = await createProject(
      companyB.company.id,
      companyB.primaryContact.id,
      {
        name: "Northwind Site",
      },
    );

    const identity = await loadIdentity(owner.id);
    const projects = await listProjectsForIdentity(identity!);

    expect(new Set(projects.map((p) => p.id))).toEqual(
      new Set([projectA.id, projectB.id]),
    );
  });

  it("lets a company's primary contact see only their own company's project", async () => {
    const companyA = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const companyB = await createClientCompanyWithPrimaryContact("Northwind Fitness");
    const projectA = await createProject(
      companyA.company.id,
      companyA.primaryContact.id,
      {
        name: "Aurora Site",
      },
    );
    await createProject(companyB.company.id, companyB.primaryContact.id, {
      name: "Northwind Site",
    });

    const identityA = await loadIdentity(companyA.primaryUser.id);
    const projects = await listProjectsForIdentity(identityA!);

    expect(projects.map((p) => p.id)).toEqual([projectA.id]);
  });

  it("returns null — the same as a nonexistent id — when a client requests another company's project directly", async () => {
    const companyA = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const companyB = await createClientCompanyWithPrimaryContact("Northwind Fitness");
    const projectB = await createProject(
      companyB.company.id,
      companyB.primaryContact.id,
      {
        name: "Northwind Site",
      },
    );

    const identityA = await loadIdentity(companyA.primaryUser.id);

    const [resultForRealForeignProject, resultForNonexistentId] = await Promise.all([
      findProjectForIdentity(identityA!, projectB.id),
      findProjectForIdentity(identityA!, "00000000-0000-0000-0000-000000000000"),
    ]);

    expect(resultForRealForeignProject).toBeNull();
    expect(resultForNonexistentId).toBeNull();
  });

  it("blocks an additional contact from a project their own company owns but they were never granted", async () => {
    const companyA = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const { user: additionalUser } = await createAdditionalContact(
      companyA.company.id,
      "Sam Ortiz",
    );
    const ungranted = await createProject(
      companyA.company.id,
      companyA.primaryContact.id,
      {
        name: "Not Granted To Sam",
      },
    );

    const identity = await loadIdentity(additionalUser.id);
    const result = await findProjectForIdentity(identity!, ungranted.id);

    expect(result).toBeNull();
  });

  it("hides an unpublished project from a client even when they hold access", async () => {
    const companyA = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const draftProject = await createProject(
      companyA.company.id,
      companyA.primaryContact.id,
      {
        name: "Still Drafting",
        isPublished: false,
      },
    );

    const identity = await loadIdentity(companyA.primaryUser.id);
    const result = await findProjectForIdentity(identity!, draftProject.id);

    expect(result).toBeNull();
  });

  it("lets OWNER see an unpublished project", async () => {
    const owner = await createOwner();
    const companyA = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const draftProject = await createProject(
      companyA.company.id,
      companyA.primaryContact.id,
      {
        name: "Still Drafting",
        isPublished: false,
      },
    );

    const identity = await loadIdentity(owner.id);
    const result = await findProjectForIdentity(identity!, draftProject.id);

    expect(result?.id).toBe(draftProject.id);
  });

  it("stops seeing a company's projects the instant a user is disabled", async () => {
    const companyA = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    await createProject(companyA.company.id, companyA.primaryContact.id, {
      name: "Aurora Site",
    });

    const identityBefore = await loadIdentity(companyA.primaryUser.id);
    expect(identityBefore).not.toBeNull();

    await prisma.user.update({
      where: { id: companyA.primaryUser.id },
      data: { status: "DISABLED" },
    });

    const identityAfter = await loadIdentity(companyA.primaryUser.id);
    expect(identityAfter).toBeNull();
  });
});
