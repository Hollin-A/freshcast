import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Domain services must stay framework-independent so they can move into
  // the NestJS API unchanged (ADR-020). Framework and UI code stays out.
  {
    files: ["src/services/**/*.ts"],
    ignores: ["src/services/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next", message: "Services must not depend on Next.js (ADR-020)." },
            { name: "react", message: "Services must not depend on React." },
            { name: "react-dom", message: "Services must not depend on React." },
            { name: "server-only", message: "Keep Next.js bundling guards in src/lib, not in services." },
          ],
          patterns: [
            { group: ["next/*"], message: "Services must not depend on Next.js (ADR-020)." },
            { group: ["@/app/*", "@/components/*", "@/hooks/*"], message: "Services must not import routes or UI code." },
          ],
        },
      ],
    },
  },
  // UI code reaches the backend through the API and shares types via
  // @freshcast/shared, not by importing services directly. (The shared
  // package enforces its own client-safety rules in its eslint.config.mjs.)
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/services", "@/services/*"], message: "UI code must not import services; use types from @freshcast/shared." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
