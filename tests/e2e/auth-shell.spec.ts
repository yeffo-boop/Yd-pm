import { test, expect } from "@playwright/test";

const SEED_PASSWORD = "YeffoHub-Dev-Only-1!";

test.describe("Phase 1 authenticated shell", () => {
  test("unauthenticated visitor is redirected to login", async ({ page }) => {
    await page.goto("/owner");
    await expect(page).toHaveURL(/\/login/);
  });

  test("owner signs in and lands on the owner dashboard with every project", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@yeffodesign.test");
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/owner$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Aurora Bakery — Website Relaunch")).toBeVisible();
    await expect(page.getByText("Northwind Fitness — New Site")).toBeVisible();
  });

  test("a client sees only their own company's project, never another's", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("dana@aurorabakery.test");
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/client$/);
    await expect(page.getByText("Aurora Bakery — Website Relaunch")).toBeVisible();
    await expect(page.getByText("Northwind Fitness — New Site")).not.toBeVisible();
  });

  test("a client is redirected away from the owner workspace", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("priya@northwindfitness.test");
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/client$/);

    await page.goto("/owner");
    await expect(page).toHaveURL(/\/client$/);
  });

  test("wrong password shows a generic error, never confirming the account exists", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@yeffodesign.test");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Next.js's own route announcer also carries role="alert", so scope to
    // our error element specifically rather than getByRole("alert").
    await expect(page.locator("#login-error")).toHaveText("Invalid email or password.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sign out ends the session", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("owner@yeffodesign.test");
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/owner$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/owner");
    await expect(page).toHaveURL(/\/login/);
  });
});
