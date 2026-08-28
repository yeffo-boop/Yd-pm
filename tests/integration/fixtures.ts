import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import type { ClientCompany, ClientContact, Project, User } from "@prisma/client";

/**
 * Not a real Argon2 hash — these fixtures never go through
 * verifyPassword(), and hashing a fresh Argon2id digest per fixture user
 * would make the authorization/isolation test suite noticeably slower for
 * no benefit. password.test.ts exercises the real hashing path.
 */
const FAKE_PASSWORD_HASH = "unused-in-authorization-tests";

export async function createOwner(): Promise<User> {
  return prisma.user.create({
    data: {
      email: `owner-${randomUUID()}@test.local`,
      passwordHash: FAKE_PASSWORD_HASH,
      role: "OWNER",
      name: "Test Owner",
    },
  });
}

export interface CompanyFixture {
  company: ClientCompany;
  primaryUser: User;
  primaryContact: ClientContact;
}

export async function createClientCompanyWithPrimaryContact(
  companyName: string,
): Promise<CompanyFixture> {
  const company = await prisma.clientCompany.create({ data: { name: companyName } });
  const primaryUser = await prisma.user.create({
    data: {
      email: `primary-${randomUUID()}@test.local`,
      passwordHash: FAKE_PASSWORD_HASH,
      role: "CLIENT",
      name: `${companyName} Primary Contact`,
    },
  });
  const primaryContact = await prisma.clientContact.create({
    data: {
      clientCompanyId: company.id,
      userId: primaryUser.id,
      name: primaryUser.name,
      email: primaryUser.email,
      isPrimary: true,
    },
  });
  return { company, primaryUser, primaryContact };
}

export async function createAdditionalContact(
  companyId: string,
  name: string,
): Promise<{ user: User; contact: ClientContact }> {
  const user = await prisma.user.create({
    data: {
      email: `additional-${randomUUID()}@test.local`,
      passwordHash: FAKE_PASSWORD_HASH,
      role: "CLIENT",
      name,
    },
  });
  const contact = await prisma.clientContact.create({
    data: {
      clientCompanyId: companyId,
      userId: user.id,
      name,
      email: user.email,
      isPrimary: false,
    },
  });
  return { user, contact };
}

export async function createProject(
  companyId: string,
  primaryContactId: string | null,
  options: { name: string; slug?: string; isPublished?: boolean },
): Promise<Project> {
  return prisma.project.create({
    data: {
      clientCompanyId: companyId,
      primaryContactId,
      name: options.name,
      slug: options.slug ?? `project-${randomUUID()}`,
      isPublished: options.isPublished ?? true,
    },
  });
}
