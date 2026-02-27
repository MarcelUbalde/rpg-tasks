// test/awardMultiUser.test.js
// Integration tests using in-memory SQLite — no mocked repositories.

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { makeUserRepository } from "../server/infrastructure/repositories/userRepository.factory.js";
import { makeRewardEventRepository } from "../server/infrastructure/repositories/rewardEventRepository.factory.js";
import { makeRewardEventUserRepository } from "../server/infrastructure/repositories/rewardEventUserRepository.factory.js";
import { awardTaskExpToUsers } from "../server/application/awardTaskExpToUsers.js";
import { awardBugGoldToUsers } from "../server/application/awardBugGoldToUsers.js";

function setupDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, level INTEGER NOT NULL DEFAULT 1,
      exp INTEGER NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE reward_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, external_key TEXT NOT NULL,
      payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(type, external_key)
    );
    CREATE TABLE reward_event_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL, user_id TEXT NOT NULL,
      exp_awarded INTEGER NOT NULL DEFAULT 0,
      gold_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(event_id, user_id)
    );
  `);
  const now = new Date().toISOString();
  const ins = db.prepare("INSERT INTO users (id, level, exp, gold, updated_at) VALUES (?, ?, ?, ?, ?)");
  ins.run("u1", 1, 0, 0, now);
  ins.run("u2", 1, 0, 0, now);
  return db;
}

function makeTransaction(db) {
  return (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };
}

function makeDeps(db) {
  return {
    db, // exposed for direct DB queries in tests that need to verify DB state
    userRepo: makeUserRepository(db),
    rewardEventRepo: makeRewardEventRepository(db),
    rewardEventUserRepo: makeRewardEventUserRepository(db),
    transaction: makeTransaction(db),
  };
}

describe("awardTaskExpToUsers", () => {
  let deps;

  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("awards full EXP to both users", () => {
    const r = awardTaskExpToUsers({ taskId: "HU-1", storyPoints: 3, userIds: ["u1", "u2"] }, deps);
    // 3 EXP from L1: costs 1 (L1→L2) + 2 (L2→L3) = 3 total → newLevel 3
    expect(r.results[0]).toMatchObject({ userId: "u1", rewarded: true, newLevel: 3 });
    expect(r.results[1]).toMatchObject({ userId: "u2", rewarded: true, newLevel: 3 });
  });

  it("is idempotent — second call skips both", () => {
    awardTaskExpToUsers({ taskId: "HU-2", storyPoints: 3, userIds: ["u1", "u2"] }, deps);
    const r2 = awardTaskExpToUsers({ taskId: "HU-2", storyPoints: 3, userIds: ["u1", "u2"] }, deps);
    expect(r2.results[0]).toMatchObject({ rewarded: false, reason: "duplicate" });
    expect(r2.results[1]).toMatchObject({ rewarded: false, reason: "duplicate" });
  });

  it("mixed scenario — first [u1], second [u1,u2] only rewards u2", () => {
    awardTaskExpToUsers({ taskId: "HU-3", storyPoints: 1, userIds: ["u1"] }, deps);
    const r2 = awardTaskExpToUsers({ taskId: "HU-3", storyPoints: 1, userIds: ["u1", "u2"] }, deps);
    expect(r2.results.find((r) => r.userId === "u1")).toMatchObject({ rewarded: false, reason: "duplicate" });
    expect(r2.results.find((r) => r.userId === "u2")).toMatchObject({ rewarded: true });
  });

  it("does not lock slot for missing user — explicitly verified in DB", () => {
    const r = awardTaskExpToUsers({ taskId: "HU-4", storyPoints: 1, userIds: ["ghost"] }, deps);
    expect(r.results[0]).toMatchObject({ rewarded: false, reason: "user_not_found" });
    // Explicitly verify: no reward_event_users row was inserted for the ghost user.
    // If a row existed, the ghost could never be rewarded later even after being added.
    const event = deps.db
      .prepare("SELECT id FROM reward_events WHERE type = ? AND external_key = ?")
      .get("TASK", "HU-4");
    const row = deps.db
      .prepare("SELECT id FROM reward_event_users WHERE event_id = ? AND user_id = ?")
      .get(event.id, "ghost");
    expect(row).toBeUndefined();
  });

  it("same key, different SP on second call → second user gets updated SP", () => {
    // u1 gets rewarded with SP=1 on first call
    awardTaskExpToUsers({ taskId: "HU-5", storyPoints: 1, userIds: ["u1"] }, deps);
    // u2 calls same key with SP=3 — upsertEvent must overwrite payload, not keep SP=1
    const r2 = awardTaskExpToUsers({ taskId: "HU-5", storyPoints: 3, userIds: ["u2"] }, deps);
    // 3 EXP from L1: costs 1 (L1→L2) + 2 (L2→L3) → newLevel 3
    expect(r2.results[0]).toMatchObject({ userId: "u2", rewarded: true, newLevel: 3 });
  });
});

describe("awardBugGoldToUsers", () => {
  let deps;

  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("awards gold=3 for High severity to both users", () => {
    const r = awardBugGoldToUsers({ jiraKey: "BUG-1", severity: "High", userIds: ["u1", "u2"] }, deps);
    expect(r.results[0]).toMatchObject({ userId: "u1", rewarded: true, goldAwarded: 3 });
    expect(r.results[1]).toMatchObject({ userId: "u2", rewarded: true, goldAwarded: 3 });
  });

  it("is idempotent — second call skips both", () => {
    awardBugGoldToUsers({ jiraKey: "BUG-2", severity: "High", userIds: ["u1", "u2"] }, deps);
    const r2 = awardBugGoldToUsers({ jiraKey: "BUG-2", severity: "High", userIds: ["u1", "u2"] }, deps);
    expect(r2.results[0]).toMatchObject({ rewarded: false, reason: "duplicate" });
    expect(r2.results[1]).toMatchObject({ rewarded: false, reason: "duplicate" });
  });

  it("mixed scenario — first [u1], second [u1,u2] only rewards u2", () => {
    awardBugGoldToUsers({ jiraKey: "BUG-3", severity: "Low", userIds: ["u1"] }, deps);
    const r2 = awardBugGoldToUsers({ jiraKey: "BUG-3", severity: "Low", userIds: ["u1", "u2"] }, deps);
    expect(r2.results.find((r) => r.userId === "u1")).toMatchObject({ rewarded: false, reason: "duplicate" });
    expect(r2.results.find((r) => r.userId === "u2")).toMatchObject({ rewarded: true, goldAwarded: 1 });
  });

  it("throws for invalid severity", () => {
    expect(() =>
      awardBugGoldToUsers({ jiraKey: "BUG-X", severity: "Legendary", userIds: ["u1"] }, deps)
    ).toThrow();
  });
});
