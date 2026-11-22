import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**"] },
  ...tseslint.configs.recommended,
  {
    // "Now" comes from the Clock provider, so tests can pin it and every
    // date goes through BusinessCalendar (ADR-013, #143).
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/calendar/clock.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Inject Clock (src/calendar/clock.ts) instead of reading the system time.",
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Inject Clock (src/calendar/clock.ts) instead of reading the system time.",
        },
      ],
    },
  },
  {
    // Features call Claude through LlmService, so tests can swap in
    // FakeLlmAdapter and every call is deadlined, checked and logged (#145).
    files: ["src/**/*.ts", "test/**/*.ts"],
    ignores: ["src/llm/anthropic.adapter.ts", "src/llm/anthropic.adapter.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"],
              message: "Call Claude through LlmService (src/llm/); only AnthropicAdapter imports the SDK.",
            },
          ],
        },
      ],
    },
  }
);
