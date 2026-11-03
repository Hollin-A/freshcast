import { test, expect, expectScreenshot } from "../fixtures";
import { E2E_OWNER } from "../env";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("log in", () => {
  test("a signed-out visitor is sent to the login page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the owner logs in and lands on their dashboard", async ({ page, appearance }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expectScreenshot(page, appearance, "login");

    await page.getByLabel("Email").fill(E2E_OWNER.email);
    await page.getByLabel("Password", { exact: true }).fill(E2E_OWNER.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Hilltop Butchers" })).toBeVisible();
  });

  test("a wrong password shows an error and stays on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_OWNER.email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
