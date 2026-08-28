import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getAuthorizedProjectScope, loadIdentity } from "@/server/services/authorization";
import { resetDatabase } from "./helpers";
import {
  createAdditionalContact,
  createClientCompanyWithPrimaryContact,
  createOwner,
  createProject,
} from "./fixtures";

beforeEach(async () => {
  await resetDatabase();
});

describe("loadIdentity", () => {
  it("resolves an OWNER identity", async () => {
    const owner = await createOwner();
    const identity = await loadIdentity(owner.id);
    expect(identity).toEqual({ role: "OWNER", userId: owner.id });
  });

  it("resolves a CLIENT identity with its ClientContact scoping fields", async () => {
    const { company, primaryUser, primaryContact } =
      await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const identity = await loadIdentity(primaryUser.id);
    expect(identity).toEqual({
      role: "CLIENT",
      userId: primaryUser.id,
      clientContactId: primaryContact.id,
      clientCompanyId: company.id,
      isPrimary: true,
    });
  });

  it("returns null for a disabled user", async () => {
    const owner = await createOwner();
    await prisma.user.update({ where: { id: owner.id }, data: { status: "DISABLED" } });
    await expect(loadIdentity(owner.id)).resolves.toBeNull();
  });

  it("returns null for a soft-deleted user", async () => {
    const owner = await createOwner();
    await prisma.user.update({
      where: { id: owner.id },
      data: { deletedAt: new Date() },
    });
    await expect(loadIdentity(owner.id)).resolves.toBeNull();
  });

  it("returns null for a nonexistent user id", async () => {
    await expect(
      loadIdentity("00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeNull();
  });
});

describe("getAuthorizedProjectScope", () => {
  it("gives OWNER unrestricted scope", async () => {
    const owner = await createOwner();
    const identity = await loadIdentity(owner.id);
    const scope = await getAuthorizedProjectScope(identity!);
    expect(scope).toEqual({ all: true });
  });

  it("gives a primary contact implicit access to every project at their company", async () => {
    const { company, primaryUser, primaryContact } =
      await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const projectA = await createProject(company.id, primaryContact.id, {
      name: "Site Relaunch",
    });
    const projectB = await createProject(company.id, primaryContact.id, {
      name: "Landing Page Refresh",
    });

    const identity = await loadIdentity(primaryUser.id);
    const scope = await getAuthorizedProjectScope(identity!);

    expect(scope.all).toBe(false);
    if (!scope.all) {
      expect(new Set(scope.projectIds)).toEqual(new Set([projectA.id, projectB.id]));
    }
  });

  it("gives an additional contact access only to projects they were explicitly granted", async () => {
    const { company, primaryUser, primaryContact } =
      await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const { user: additionalUser, contact: additionalContact } =
      await createAdditionalContact(company.id, "Sam Ortiz");
    const grantedProject = await createProject(company.id, primaryContact.id, {
      name: "Site Relaunch",
    });
    await createProject(company.id, primaryContact.id, { name: "Not Granted" });

    await prisma.projectMembership.create({
      data: {
        projectId: grantedProject.id,
        clientContactId: additionalContact.id,
        grantedByUserId: primaryUser.id,
      },
    });

    const identity = await loadIdentity(additionalUser.id);
    const scope = await getAuthorizedProjectScope(identity!);

    expect(scope.all).toBe(false);
    if (!scope.all) {
      expect(scope.projectIds).toEqual([grantedProject.id]);
    }
  });

  it("gives an additional contact with no grants an empty scope", async () => {
    const { company } = await createClientCompanyWithPrimaryContact("Aurora Bakery");
    const { user: additionalUser } = await createAdditionalContact(
      company.id,
      "Sam Ortiz",
    );

    const identity = await loadIdentity(additionalUser.id);
    const scope = await getAuthorizedProjectScope(identity!);

    expect(scope).toEqual({ all: false, projectIds: [] });
  });
});
