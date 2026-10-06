import tseslint from "typescript-eslint";

// Shared code is imported by browser forms and by the API, so it may only use
// zod and its own modules: no framework, Node or server-only imports.
export default tseslint.config(
  { ignores: ["dist/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "server-only", message: "Shared code must stay client-safe." }],
          patterns: [
            { regex: "^(?!zod$|\\.{1,2}/)", message: "Shared code may only import zod and its own modules." },
          ],
        },
      ],
    },
  }
);
