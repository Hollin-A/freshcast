import { test as setup, expect } from "./fixtures";
import { E2E_OWNER, OWNER_STATE } from "./env";

// Logs in once through the real Auth.js flow and saves the session cookie
// for the journeys that start signed in.
setup("log in as the seeded owner", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_OWNER.email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_OWNER.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: OWNER_STATE });
});
