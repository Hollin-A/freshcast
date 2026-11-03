import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// The API decrypts cookies that the App's next-auth issues, so both must use
// the same @auth/core (ADR-023 §10). Bumping next-auth without bumping the
// API's @auth/core fails here instead of logging everyone out in production.

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("Auth.js bridge", () => {
  const webPackagePath = new URL("../../../web/package.json", import.meta.url);
  const api = readJson(new URL("../../package.json", import.meta.url).pathname);
  const web = readJson(webPackagePath.pathname);

  it("pins next-auth to an exact version in the App", () => {
    expect(web.dependencies["next-auth"]).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });

  it("uses the same @auth/core as the App's next-auth", () => {
    const nextAuth = readJson(
      createRequire(webPackagePath).resolve("next-auth/package.json")
    );
    expect(api.dependencies["@auth/core"]).toBe(nextAuth.dependencies["@auth/core"]);
  });
});
