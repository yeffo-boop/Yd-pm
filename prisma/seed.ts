/**
 * Deterministic local-development seed data.
 *
 * Fixed UUIDs and fixed content mean re-running this against a fresh
 * database always produces the exact same rows — useful for tests, demos,
 * and manual QA. This is dev/test-only data: fictional companies, fake
 * addresses, and a single shared dev-only password (see console output
 * below). It is never real client information and must never be used as a
 * template for production bootstrap — see scripts/bootstrap-owner.ts for
 * how the real first OWNER account is created.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/security/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_SEED_PASSWORD = "YeffoHub-Dev-Only-1!";

const IDS = {
  owner: "00000000-0000-4000-8000-000000000001",
  companyA: "00000000-0000-4000-8000-0000000000a1",
  companyAPrimaryUser: "00000000-0000-4000-8000-0000000000a2",
  companyAPrimaryContact: "00000000-0000-4000-8000-0000000000a3",
  companyAAdditionalUser: "00000000-0000-4000-8000-0000000000a4",
  companyAAdditionalContact: "00000000-0000-4000-8000-0000000000a5",
  companyAProject: "00000000-0000-4000-8000-0000000000a6",
  companyB: "00000000-0000-4000-8000-0000000000b1",
  companyBPrimaryUser: "00000000-0000-4000-8000-0000000000b2",
  companyBPrimaryContact: "00000000-0000-4000-8000-0000000000b3",
  companyBAdditionalUser: "00000000-0000-4000-8000-0000000000b4",
  companyBAdditionalContact: "00000000-0000-4000-8000-0000000000b5",
  companyBProject: "00000000-0000-4000-8000-0000000000b6",
} as const;

async function main() {
  const passwordHash = await hashPassword(DEV_SEED_PASSWORD);

  const owner = await prisma.user.upsert({
    where: { id: IDS.owner },
    create: {
      id: IDS.owner,
      email: "owner@yeffodesign.test",
      passwordHash,
      role: "OWNER",
      name: "Yeffo (Owner, dev seed)",
      timeZone: "America/New_York",
    },
    update: {},
  });

  // --- Client company A: two contacts, one project, additional contact
  // granted explicit project access (exercises ProjectMembership). ---
  const companyA = await prisma.clientCompany.upsert({
    where: { id: IDS.companyA },
    create: { id: IDS.companyA, name: "Aurora Bakery Co. (seed)" },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: IDS.companyAPrimaryUser },
    create: {
      id: IDS.companyAPrimaryUser,
      email: "dana@aurorabakery.test",
      passwordHash,
      role: "CLIENT",
      name: "Dana Whitfield",
    },
    update: {},
  });
  const companyAPrimaryContact = await prisma.clientContact.upsert({
    where: { id: IDS.companyAPrimaryContact },
    create: {
      id: IDS.companyAPrimaryContact,
      clientCompanyId: companyA.id,
      userId: IDS.companyAPrimaryUser,
      name: "Dana Whitfield",
      email: "dana@aurorabakery.test",
      isPrimary: true,
      title: "Owner",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: IDS.companyAAdditionalUser },
    create: {
      id: IDS.companyAAdditionalUser,
      email: "sam@aurorabakery.test",
      passwordHash,
      role: "CLIENT",
      name: "Sam Ortiz",
    },
    update: {},
  });
  const companyAAdditionalContact = await prisma.clientContact.upsert({
    where: { id: IDS.companyAAdditionalContact },
    create: {
      id: IDS.companyAAdditionalContact,
      clientCompanyId: companyA.id,
      userId: IDS.companyAAdditionalUser,
      name: "Sam Ortiz",
      email: "sam@aurorabakery.test",
      isPrimary: false,
      title: "Marketing Lead",
    },
    update: {},
  });

  const companyAProject = await prisma.project.upsert({
    where: { id: IDS.companyAProject },
    create: {
      id: IDS.companyAProject,
      clientCompanyId: companyA.id,
      primaryContactId: companyAPrimaryContact.id,
      name: "Aurora Bakery — Website Relaunch",
      slug: "aurora-bakery-relaunch",
      isPublished: true,
    },
    update: {},
  });

  await prisma.projectMembership.upsert({
    where: {
      projectId_clientContactId: {
        projectId: companyAProject.id,
        clientContactId: companyAAdditionalContact.id,
      },
    },
    create: {
      projectId: companyAProject.id,
      clientContactId: companyAAdditionalContact.id,
      grantedByUserId: owner.id,
    },
    update: {},
  });

  // --- Client company B: isolated from company A, used by cross-tenant
  // authorization tests to prove B can never reach A's data. ---
  const companyB = await prisma.clientCompany.upsert({
    where: { id: IDS.companyB },
    create: { id: IDS.companyB, name: "Northwind Fitness Studio (seed)" },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: IDS.companyBPrimaryUser },
    create: {
      id: IDS.companyBPrimaryUser,
      email: "priya@northwindfitness.test",
      passwordHash,
      role: "CLIENT",
      name: "Priya Kapoor",
    },
    update: {},
  });
  const companyBPrimaryContact = await prisma.clientContact.upsert({
    where: { id: IDS.companyBPrimaryContact },
    create: {
      id: IDS.companyBPrimaryContact,
      clientCompanyId: companyB.id,
      userId: IDS.companyBPrimaryUser,
      name: "Priya Kapoor",
      email: "priya@northwindfitness.test",
      isPrimary: true,
      title: "Studio Director",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { id: IDS.companyBAdditionalUser },
    create: {
      id: IDS.companyBAdditionalUser,
      email: "leo@northwindfitness.test",
      passwordHash,
      role: "CLIENT",
      name: "Leo Chen",
    },
    update: {},
  });
  await prisma.clientContact.upsert({
    where: { id: IDS.companyBAdditionalContact },
    create: {
      id: IDS.companyBAdditionalContact,
      clientCompanyId: companyB.id,
      userId: IDS.companyBAdditionalUser,
      name: "Leo Chen",
      email: "leo@northwindfitness.test",
      isPrimary: false,
      title: "Operations",
    },
    update: {},
  });
  // Deliberately no ProjectMembership for Leo — used by tests as "a real
  // additional contact at the company who has not been granted access to
  // this particular project."

  await prisma.project.upsert({
    where: { id: IDS.companyBProject },
    create: {
      id: IDS.companyBProject,
      clientCompanyId: companyB.id,
      primaryContactId: companyBPrimaryContact.id,
      name: "Northwind Fitness — New Site",
      slug: "northwind-fitness-new-site",
      isPublished: true,
    },
    update: {},
  });

  console.log("Seed complete.");
  console.log(`  Owner login:            owner@yeffodesign.test`);
  console.log(`  Company A primary:      dana@aurorabakery.test`);
  console.log(`  Company A additional:   sam@aurorabakery.test`);
  console.log(`  Company B primary:      priya@northwindfitness.test`);
  console.log(`  Company B additional:   leo@northwindfitness.test`);
  console.log(`  Dev-only password for all seeded accounts: ${DEV_SEED_PASSWORD}`);
  console.log(
    "  This password is for local development only — never used in production.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
