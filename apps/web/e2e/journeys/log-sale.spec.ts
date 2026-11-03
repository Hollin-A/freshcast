import { test, expect, expectScreenshot } from "../fixtures";
import { FIXTURE_TODAY } from "@/test/msw/fixtures/types";

test("the owner logs today's sales in their own words", async ({ page, appearance }) => {
  await page.goto("/sales");
  await expect(page.getByRole("heading", { name: "Tell me your day." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "In your words" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("textbox").last().fill("Lamb chops and minced beef");
  await expectScreenshot(page, appearance, "log-sale-input");

  await page.getByRole("button", { name: "Review & save →" }).click();
  await expect(page.getByRole("heading", { name: "Looks good?" })).toBeVisible();
  await expectScreenshot(page, appearance, "log-sale-review");

  const save = page.waitForRequest(
    (req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/sales",
  );
  await page.getByRole("button", { name: "Save sales log" }).click();

  const body = (await save).postDataJSON();
  expect(body).toMatchObject({
    date: FIXTURE_TODAY,
    inputMethod: "NATURAL_LANGUAGE",
    items: [
      expect.objectContaining({ productId: "prod_lamb", quantity: 1 }),
      expect.objectContaining({ productId: "prod_beef", quantity: 1 }),
    ],
  });
  await expect(page.getByText("Sales saved")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});
