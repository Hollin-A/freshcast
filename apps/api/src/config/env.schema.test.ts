import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.schema.js";

const DATABASE_URL = "postgresql://user:pass@localhost:5432/freshcast";

describe("validateEnv", () => {
  it("applies defaults when only the required values are set", () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      DATABASE_URL,
      AWS_REGION: "ap-southeast-2",
    });
  });

  it("coerces PORT from a string", () => {
    expect(validateEnv({ DATABASE_URL, PORT: "8080" }).PORT).toBe(8080);
  });

  it("names a missing DATABASE_URL in the error", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*is required|is required[\s\S]*DATABASE_URL/);
  });

  it("rejects a non-Postgres DATABASE_URL", () => {
    expect(() => validateEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /postgres/
    );
  });

  it("rejects an out-of-range PORT", () => {
    expect(() => validateEnv({ DATABASE_URL, PORT: "70000" })).toThrow(/PORT/);
  });
});
