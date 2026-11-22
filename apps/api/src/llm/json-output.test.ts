import { describe, expect, it } from "vitest";
import { extractJson } from "./json-output.js";

describe("extractJson", () => {
  it.each([
    ["bare JSON", '[{"a":1}]', [{ a: 1 }]],
    ["bare JSON with whitespace", '\n  {"a":1}  \n', { a: 1 }],
    ["a ```json fence", 'Sure:\n```json\n{"a":1}\n```\nDone.', { a: 1 }],
    ["a plain ``` fence", '```\n[1,2]\n```', [1, 2]],
    ["the first of two fences", '```json\n{"a":1}\n```\n```json\n{"a":2}\n```', { a: 1 }],
    ["JSON null", "null", null],
  ])("reads %s", (_name, text, json) => {
    expect(extractJson(text)).toEqual({ json });
  });

  it.each([
    ["prose", "I couldn't find any sales."],
    ["an empty reply", ""],
    ["a fence holding prose", "```\nnot json\n```"],
    ["truncated JSON", '[{"a":1},{"a"'],
  ])("returns undefined for %s", (_name, text) => {
    expect(extractJson(text)).toBeUndefined();
  });

  it("returns undefined for an empty fence, which falls back to the whole reply as in Legacy", () => {
    expect(extractJson("``````")).toBeUndefined();
  });
});
