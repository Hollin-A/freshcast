import { test, expect, expectScreenshot } from "../fixtures";

test("the owner sees today's status and their top products", async ({ page, appearance }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Hilltop Butchers" })).toBeVisible();
  await expect(page.getByText(/Today · /).first()).toBeVisible();
  await expect(page.getByText("Lamb chops").first()).toBeVisible();

  await expectScreenshot(page, appearance, "dashboard");
});
