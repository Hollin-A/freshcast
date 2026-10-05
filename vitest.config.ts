import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
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
});
