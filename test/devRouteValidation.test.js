// test/devRouteValidation.test.js
// Unit tests for route-level input validators in server/routes/dev.js.
// No database or HTTP server required.

import { describe, it, expect } from "vitest";
import { parseStoryPoints } from "../server/routes/dev.js";

describe("parseStoryPoints", () => {
  it('"5.5" (string) → 5.5', () => expect(parseStoryPoints("5.5")).toBe(5.5));
  it("5.5 (number) → 5.5",   () => expect(parseStoryPoints(5.5)).toBe(5.5));
  it("5 (integer) → 5",      () => expect(parseStoryPoints(5)).toBe(5));
  it("0 → throws",           () => expect(() => parseStoryPoints(0)).toThrow("positive number"));
  it("null → throws",        () => expect(() => parseStoryPoints(null)).toThrow("positive number"));
  it('"abc" → throws',       () => expect(() => parseStoryPoints("abc")).toThrow("positive number"));
  it('"" → throws',          () => expect(() => parseStoryPoints("")).toThrow("positive number"));
  it('"  " → throws',        () => expect(() => parseStoryPoints("  ")).toThrow("positive number"));
});
