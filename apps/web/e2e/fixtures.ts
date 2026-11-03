import { test as base, expect, type Page } from "@playwright/test";
import { defineNetworkFixture, type NetworkFixture } from "@msw/playwright";
import type { AnyHandler } from "msw";
import { createHandlers } from "@/test/msw/handlers";
import { FIXTURE_TODAY } from "@/test/msw/fixtures/types";

export { expect };

type Appearance = "light" | "dark";

type Fixtures = {
  /** Handlers for the browser's API calls; override per test with network.use(). */
  handlers: AnyHandler[];
  network: NetworkFixture;
  /** Set per project in playwright.config.ts. */
  appearance: Appearance;
};

// Auth.js runs for real against the seeded database, so its routes pass
// through to the App. Every other /api call is answered by the same MSW
// handlers as the component tests and Storybook.
const isAuthRoute = (path: string) => path.startsWith("/api/auth/");

const appHandlers = createHandlers().filter(
  (h) => !("path" in h.info && typeof h.info.path === "string" && isAuthRoute(h.info.path)),
);

export const test = base.extend<Fixtures>({
  appearance: ["light", { option: true }],
  handlers: [appHandlers, { option: true }],

  network: [
    async ({ context, handlers }, use) => {
      const unhandled: string[] = [];
      const network = defineNetworkFixture({
        context,
        handlers,
        // Pages, assets and Auth.js go to the App. An API call without a
        // handler is collected and fails the test, as in the component tests.
        onUnhandledFrame({ frame, defaults }) {
          if (!("request" in frame) || !(frame.request instanceof Request)) return;
          const { pathname } = new URL(frame.request.url);
          if (pathname.startsWith("/api/") && !isAuthRoute(pathname)) {
            unhandled.push(`${frame.request.method} ${pathname}`);
            defaults.error();
          }
        },
      });
      await network.enable();
      await use(network);
      await network.disable();
      expect(unhandled, "API requests without an MSW handler").toEqual([]);
    },
    { auto: true },
  ],

  // Freeze the browser's clock on the fixture date, in the evening after
  // closing, so "today" in the App matches the fixture data. Timers still run.
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(`${FIXTURE_TODAY}T19:30:00+10:00`));
    await use(page);
  },
});

/**
 * Full-page screenshot in the project's Appearance. The App has no
 * Appearance setting yet (#99), so dark is applied with the same `dark`
 * class Storybook uses; the projects also emulate prefers-color-scheme, which
 * the "system" setting will follow.
 */
export async function expectScreenshot(page: Page, appearance: Appearance, name: string) {
  await page.evaluate((dark) => {
    document.documentElement.classList.toggle("dark", dark);
  }, appearance === "dark");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}
