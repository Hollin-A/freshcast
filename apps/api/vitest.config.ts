import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests only; the e2e tests in test/ have their own config
    // (vitest.e2e.config.ts) because they need a database.
    include: ["src/**/*.test.ts"],
  },
  // Vitest's default transform (esbuild) can't emit decorator metadata, which
  // Nest's dependency injection reads; compile tests with SWC instead.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
