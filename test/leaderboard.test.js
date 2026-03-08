// test/leaderboard.test.js
// Unit tests for buildLeaderboard() pure function.
// No database or HTTP server required.

import { describe, it, expect } from "vitest";
import { buildLeaderboard } from "../server/routes/leaderboard.js";

describe("buildLeaderboard", () => {
  it("returns empty array for no rows", () => {
    expect(buildLeaderboard([])).toEqual([]);
  });

  it("assigns sequential ranks starting at 1", () => {
    const rows = [
      { id: "u1", level: 3, exp: 5, gold: 2 },
      { id: "u2", level: 2, exp: 8, gold: 1 },
      { id: "u3", level: 1, exp: 0, gold: 0 },
    ];
    const result = buildLeaderboard(rows);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
  });

  it("maps userId from id field", () => {
    const rows = [{ id: "u1", level: 5, exp: 8, gold: 12 }];
    const [entry] = buildLeaderboard(rows);
    expect(entry.userId).toBe("u1");
  });

  it("preserves level, exp and gold values", () => {
    const rows = [{ id: "u1", level: 5, exp: 8, gold: 12 }];
    const [entry] = buildLeaderboard(rows);
    expect(entry.level).toBe(5);
    expect(entry.exp).toBe(8);
    expect(entry.gold).toBe(12);
  });

  it("does not include extra fields beyond rank/userId/level/exp/gold", () => {
    const rows = [{ id: "u1", level: 1, exp: 0, gold: 0 }];
    const [entry] = buildLeaderboard(rows);
    expect(Object.keys(entry).sort()).toEqual(["exp", "gold", "level", "rank", "userId"]);
  });
});
