import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.schema.js";

const DATABASE_URL = "postgresql://user:pass@localhost:5432/freshcast";
const AUTH_SECRET = "a".repeat(32);
const required = { DATABASE_URL, AUTH_SECRET };

describe("validateEnv", () => {
  it("applies defaults when only the required values are set", () => {
    expect(validateEnv(required)).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      DATABASE_URL,
      AUTH_SECRET,
      AWS_REGION: "ap-southeast-2",
    });
  });

  it("coerces PORT from a string", () => {
    expect(validateEnv({ ...required, PORT: "8080" }).PORT).toBe(8080);
  });

  it("names a missing DATABASE_URL in the error", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*is required|is required[\s\S]*DATABASE_URL/);
  });

  it("rejects a non-Postgres DATABASE_URL", () => {
    expect(() => validateEnv({ ...required, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /postgres/
    );
  });

  it("rejects an out-of-range PORT", () => {
    expect(() => validateEnv({ ...required, PORT: "70000" })).toThrow(/PORT/);
  });

  it("accepts RECEIPT_FALLBACK=structured", () => {
    expect(validateEnv({ ...required, RECEIPT_FALLBACK: "structured" }).RECEIPT_FALLBACK).toBe("structured");
  });

  it("rejects any other RECEIPT_FALLBACK, so a typo can't turn it off", () => {
    expect(() => validateEnv({ ...required, RECEIPT_FALLBACK: "structred" })).toThrow(/RECEIPT_FALLBACK/);
  });

  // The image sets APP_VERSION from a build argument, which is empty when a
  // build doesn't pass one (a local `docker build`).
  it("treats an empty APP_VERSION as unset", () => {
    expect(validateEnv({ ...required, APP_VERSION: "" }).APP_VERSION).toBeUndefined();
  });

  it("names a missing AUTH_SECRET in the error", () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/AUTH_SECRET/);
  });

  it("rejects a short AUTH_SECRET", () => {
    expect(() => validateEnv({ DATABASE_URL, AUTH_SECRET: "too-short" })).toThrow(/32 characters/);
  });
});
