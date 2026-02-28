// test/splitEventApplication.test.js
// Integration tests for the split event-creation / event-application use cases.

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { makeUserRepository } from "../server/infrastructure/repositories/userRepository.factory.js";
import { makeRewardEventRepository } from "../server/infrastructure/repositories/rewardEventRepository.factory.js";
import { makeRewardEventUserRepository } from "../server/infrastructure/repositories/rewardEventUserRepository.factory.js";
import { createTaskRewardEvent } from "../server/application/createTaskRewardEvent.js";
import { createBugRewardEvent }  from "../server/application/createBugRewardEvent.js";
import { applyRewardEventToUsers } from "../server/application/applyRewardEventToUsers.js";

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
  return async (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn();
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
    db,
    userRepo: makeUserRepository(db),
    rewardEventRepo: makeRewardEventRepository(db),
    rewardEventUserRepo: makeRewardEventUserRepository(db),
    transaction: makeTransaction(db),
  };
}

// ─── createTaskRewardEvent ────────────────────────────────────────────────────

describe("createTaskRewardEvent", () => {
  let deps;
  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("creates a TASK event and returns id/type/key", async () => {
    const { event } = await createTaskRewardEvent({ taskId: "HU-1", storyPoints: 3 }, deps);
    expect(event.id).toBeTypeOf("number");
    expect(event.type).toBe("TASK");
    expect(event.key).toBe("HU-1");
  });

  it("same key twice → same eventId (idempotent)", async () => {
    const r1 = await createTaskRewardEvent({ taskId: "HU-1", storyPoints: 3 }, deps);
    const r2 = await createTaskRewardEvent({ taskId: "HU-1", storyPoints: 3 }, deps);
    expect(r1.event.id).toBe(r2.event.id);
  });

  it("throws for non-positive storyPoints", async () => {
    await expect(createTaskRewardEvent({ taskId: "HU-X", storyPoints: 0 }, deps)).rejects.toThrow();
    await expect(createTaskRewardEvent({ taskId: "HU-X", storyPoints: -1 }, deps)).rejects.toThrow();
  });
});

// ─── createBugRewardEvent ─────────────────────────────────────────────────────

describe("createBugRewardEvent", () => {
  let deps;
  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("creates a BUG event and returns id/type/key", async () => {
    const { event } = await createBugRewardEvent({ jiraKey: "BUG-1", severity: "High" }, deps);
    expect(event.id).toBeTypeOf("number");
    expect(event.type).toBe("BUG");
    expect(event.key).toBe("BUG-1");
  });

  it("same key twice → same eventId (idempotent)", async () => {
    const r1 = await createBugRewardEvent({ jiraKey: "BUG-1", severity: "High" }, deps);
    const r2 = await createBugRewardEvent({ jiraKey: "BUG-1", severity: "High" }, deps);
    expect(r1.event.id).toBe(r2.event.id);
  });

  it("throws for invalid severity", async () => {
    await expect(createBugRewardEvent({ jiraKey: "BUG-X", severity: "Legendary" }, deps)).rejects.toThrow();
  });
});

// ─── applyRewardEventToUsers ─────────────────────────────────────────────────

describe("applyRewardEventToUsers — TASK", () => {
  let deps;
  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("first apply → rewarded; second apply same user → duplicate", async () => {
    const { event } = await createTaskRewardEvent({ taskId: "HU-T1", storyPoints: 5 }, deps);

    const r1 = await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1"] }, deps);
    expect(r1.results[0]).toMatchObject({ userId: "u1", rewarded: true });
    expect(r1.event).toMatchObject({ type: "TASK", key: "HU-T1" });

    const r2 = await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1"] }, deps);
    expect(r2.results[0]).toMatchObject({ userId: "u1", rewarded: false, reason: "duplicate" });
  });

  it("apply to new user after initial apply → rewarded (replay to newcomer)", async () => {
    const { event } = await createTaskRewardEvent({ taskId: "HU-T2", storyPoints: 3 }, deps);

    await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1"] }, deps);

    const r2 = await applyRewardEventToUsers({ eventId: event.id, userIds: ["u2"] }, deps);
    expect(r2.results[0]).toMatchObject({ userId: "u2", rewarded: true });
  });

  it("returns correct EXP and level-up info", async () => {
    const { event } = await createTaskRewardEvent({ taskId: "HU-T3", storyPoints: 3 }, deps);
    const r = await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1"] }, deps);
    // 3 EXP from L1: costs 1 (L1→L2) + 2 (L2→L3) → newLevel 3
    expect(r.results[0]).toMatchObject({ rewarded: true, newLevel: 3, levelsGained: 2 });
  });

  it("unknown user → user_not_found (no slot locked)", async () => {
    const { event } = await createTaskRewardEvent({ taskId: "HU-T4", storyPoints: 1 }, deps);
    const r = await applyRewardEventToUsers({ eventId: event.id, userIds: ["ghost"] }, deps);
    expect(r.results[0]).toMatchObject({ userId: "ghost", rewarded: false, reason: "user_not_found" });
    // Verify no row was locked in reward_event_users
    const row = deps.db
      .prepare("SELECT id FROM reward_event_users WHERE event_id = ? AND user_id = ?")
      .get(event.id, "ghost");
    expect(row).toBeUndefined();
  });
});

describe("applyRewardEventToUsers — BUG", () => {
  let deps;
  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("awards correct gold for Critical severity", async () => {
    const { event } = await createBugRewardEvent({ jiraKey: "BUG-B1", severity: "Critical" }, deps);
    const r = await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1"] }, deps);
    expect(r.results[0]).toMatchObject({ userId: "u1", rewarded: true, goldAwarded: 5 });
    expect(r.event).toMatchObject({ type: "BUG", key: "BUG-B1" });
  });

  it("duplicate blocked on second apply", async () => {
    const { event } = await createBugRewardEvent({ jiraKey: "BUG-B2", severity: "High" }, deps);
    await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1"] }, deps);
    const r2 = await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1"] }, deps);
    expect(r2.results[0]).toMatchObject({ rewarded: false, reason: "duplicate" });
  });

  it("applies to both users independently", async () => {
    const { event } = await createBugRewardEvent({ jiraKey: "BUG-B3", severity: "Medium" }, deps);
    const r = await applyRewardEventToUsers({ eventId: event.id, userIds: ["u1", "u2"] }, deps);
    expect(r.results).toHaveLength(2);
    expect(r.results[0]).toMatchObject({ rewarded: true, goldAwarded: 2 });
    expect(r.results[1]).toMatchObject({ rewarded: true, goldAwarded: 2 });
  });
});

describe("applyRewardEventToUsers — error cases", () => {
  let deps;
  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("unknown eventId → throws", async () => {
    await expect(
      applyRewardEventToUsers({ eventId: 9999, userIds: ["u1"] }, deps)
    ).rejects.toThrow(/event not found/);
  });

  it("empty userIds → throws", async () => {
    const { event } = await createTaskRewardEvent({ taskId: "HU-E1", storyPoints: 1 }, deps);
    await expect(
      applyRewardEventToUsers({ eventId: event.id, userIds: [] }, deps)
    ).rejects.toThrow();
  });

  it("corrupted payload_json → throws controlled error", async () => {
    // Directly insert a broken event row
    deps.db.prepare(
      `INSERT INTO reward_events (type, external_key, payload_json, created_at)
       VALUES ('TASK', 'HU-BAD', 'not-valid-json', ?)`
    ).run(new Date().toISOString());
    const bad = deps.db
      .prepare("SELECT id FROM reward_events WHERE external_key = 'HU-BAD'")
      .get();
    await expect(
      applyRewardEventToUsers({ eventId: bad.id, userIds: ["u1"] }, deps)
    ).rejects.toThrow(/invalid payload_json/);
  });
});
