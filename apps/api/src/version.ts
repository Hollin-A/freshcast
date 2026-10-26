import { createRequire } from "node:module";

// src/ and dist/ both sit one level below apps/api.
export const { version: PACKAGE_VERSION } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};
