import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// HTTP-level tests of the whole app against a throwaway Postgres
// (test/compose.yml). Run `pnpm --filter @freshcast/api e2e:up` first.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.e2e-spec.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup-env.ts"],
    // The files share one database and each empties it, so run them one at a time.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
