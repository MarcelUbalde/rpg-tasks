// test/userIds.test.js
import { describe, it, expect } from "vitest";
import { deduplicateUserIds } from "../server/application/userIds.js";

describe("deduplicateUserIds", () => {
  it("throws exact message for empty array", () => {
    expect(() => deduplicateUserIds([])).toThrow("userIds must be a non-empty array");
  });

  it("throws exact message for undefined (not 'is not iterable')", () => {
    expect(() => deduplicateUserIds(undefined)).toThrow("userIds must be a non-empty array");
  });

  it("deduplicates and returns unique ids", () => {
    expect(deduplicateUserIds(["u1", "u2", "u1"])).toEqual(["u1", "u2"]);
  });
});
