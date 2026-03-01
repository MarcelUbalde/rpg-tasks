// test/pgCoerce.test.js
// Unit tests for PG NUMERIC coercion helpers — no database required.
// Guards against regression of the bug where pg returns NUMERIC as strings,
// causing string concatenation in applyExpGain instead of numeric addition.

import { describe, it, expect } from "vitest";
import { coerceNumeric } from "../server/infrastructure/pgNumeric.js";
import { mapUser } from "../server/infrastructure/repositories/userRepository.pg.factory.js";

const baseRow = { id: "u1", level: 1, gold: 0, updated_at: "2024-01-01T00:00:00.000Z" };

describe("coerceNumeric", () => {
  it('converts "0.00" → 0',  () => expect(coerceNumeric("0.00")).toBe(0));
  it('converts "5.00" → 5',  () => expect(coerceNumeric("5.00")).toBe(5));
  it('converts "1.50" → 1.5', () => expect(coerceNumeric("1.50")).toBe(1.5));
  it('converts "2.50" → 2.5', () => expect(coerceNumeric("2.50")).toBe(2.5));
  it("passes through JS number unchanged", () => expect(coerceNumeric(3)).toBe(3));
  it("throws on null",      () => expect(() => coerceNumeric(null)).toThrow("coerceNumeric"));
  it("throws on undefined", () => expect(() => coerceNumeric(undefined)).toThrow("coerceNumeric"));
  it('throws on "abc"',     () => expect(() => coerceNumeric("abc")).toThrow("coerceNumeric"));
  it("throws on NaN",       () => expect(() => coerceNumeric(NaN)).toThrow("coerceNumeric"));
});

describe("mapUser", () => {
  it("returns null for null input", () => expect(mapUser(null)).toBeNull());

  it('coerces exp "0.00" string to number 0', () => {
    expect(mapUser({ ...baseRow, exp: "0.00" }).exp).toBe(0);
  });

  it('coerces exp "5.00" string to number 5', () => {
    expect(mapUser({ ...baseRow, exp: "5.00" }).exp).toBe(5);
  });

  it('coerces exp "2.50" string to number 2.5 (decimal support)', () => {
    expect(mapUser({ ...baseRow, exp: "2.50" }).exp).toBe(2.5);
  });

  it("preserves all other fields unchanged", () => {
    const row = { id: "u2", level: 3, exp: "2.50", gold: 10, updated_at: "t" };
    expect(mapUser(row)).toMatchObject({ id: "u2", level: 3, gold: 10, exp: 2.5 });
  });
});
