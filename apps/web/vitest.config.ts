import { defineConfig, type TestProjectInlineConfiguration } from "vitest/config";
import react from "@vitejs/plugin-react";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import path from "path";

// Stories run as tests in Chromium, once per Appearance, so every story is
// checked in both light and dark.
function storybookProject(theme: "light" | "dark"): TestProjectInlineConfiguration {
  return {
    extends: true,
    plugins: [
      storybookTest({
        configDir: path.join(__dirname, ".storybook"),
        initialGlobals: { theme },
      }),
    ],
    test: {
      name: `storybook-${theme}`,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
      },
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The `server-only` package throws on import outside a Next.js
      // server-component bundle. Tests run in plain Node, so alias it to a
      // no-op stub. The production safeguard still applies — Next.js will
      // reject any client-side import of guarded modules at build time.
      // See docs/adr/017-next-config-no-env.md.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        // Component tests render React into jsdom. Async Server Components
        // aren't supported by Vitest; cover those with end-to-end tests.
        extends: true,
        plugins: [react()],
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup-component.ts"],
        },
      },
      storybookProject("light"),
      storybookProject("dark"),
    ],
  },
});
