import cdkPlugin from "eslint-plugin-awscdk";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["cdk.out/**"] },
  ...tseslint.configs.recommended,
  // CDK-specific rules (construct IDs, props shapes, no hard-coded
  // physical names where CDK can generate them). Needs type information.
  {
    files: ["bin/**/*.ts", "lib/**/*.ts"],
    extends: [cdkPlugin.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
);
