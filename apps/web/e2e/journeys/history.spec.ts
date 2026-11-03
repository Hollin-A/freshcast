import { test, expect, expectScreenshot } from "../fixtures";

test("the owner reviews their past sales logs", async ({ page, appearance }) => {
  await page.goto("/sales/history");

  await expect(page.getByRole("heading", { name: "Your history" })).toBeVisible();
  await expect(page.getByText("Lamb chops").first()).toBeVisible();

  await expectScreenshot(page, appearance, "history");
});
