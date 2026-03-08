// test/activity.test.js
// Unit tests for mapActivityRow() pure function.
// No database or HTTP server required.

import { describe, it, expect } from "vitest";
import { mapActivityRow } from "../server/infrastructure/repositories/rewardHistoryRepository.pg.factory.js";

const baseRow = {
  user_id:     "u1",
  type:        "TASK",
  issue_key:   "HU-123",
  summary:     "Implementar login",
  story_points: "3.00",
  severity:    null,
  exp_awarded: "3.00",
  gold_awarded: 0,
  created_at:  "2026-03-08T10:00:00.000Z",
};

describe("mapActivityRow", () => {
  it("mapea todos los campos correctamente", () => {
    const result = mapActivityRow(baseRow);
    expect(result.userId).toBe("u1");
    expect(result.type).toBe("TASK");
    expect(result.issueKey).toBe("HU-123");
    expect(result.summary).toBe("Implementar login");
    expect(result.storyPoints).toBe(3);
    expect(result.severity).toBeNull();
    expect(result.expAwarded).toBe(3);
    expect(result.goldAwarded).toBe(0);
    expect(result.createdAt).toBe("2026-03-08T10:00:00.000Z");
  });

  it("storyPoints es null si story_points es null", () => {
    const row = { ...baseRow, story_points: null };
    expect(mapActivityRow(row).storyPoints).toBeNull();
  });

  it("storyPoints se coerciona de NUMERIC string a number", () => {
    const row = { ...baseRow, story_points: "5.50" };
    expect(mapActivityRow(row).storyPoints).toBe(5.5);
  });

  it("expAwarded se coerciona de NUMERIC string a number", () => {
    const row = { ...baseRow, exp_awarded: "2.00" };
    expect(mapActivityRow(row).expAwarded).toBe(2);
  });

  it("campos null DB → null en output (no undefined)", () => {
    const row = { ...baseRow, issue_key: null, summary: null, severity: null };
    const result = mapActivityRow(row);
    expect(result.issueKey).toBeNull();
    expect(result.summary).toBeNull();
    expect(result.severity).toBeNull();
  });

  it("severity se incluye correctamente para BUG", () => {
    const row = { ...baseRow, type: "BUG", issue_key: "BUG-45", story_points: null, severity: "High", exp_awarded: "0", gold_awarded: 5 };
    const result = mapActivityRow(row);
    expect(result.type).toBe("BUG");
    expect(result.severity).toBe("High");
    expect(result.storyPoints).toBeNull();
    expect(result.goldAwarded).toBe(5);
    expect(result.expAwarded).toBe(0);
  });
});
