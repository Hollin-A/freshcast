import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  // Vitest's default transform (esbuild) can't emit decorator metadata, which
  // Nest's dependency injection reads; compile tests with SWC instead.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
