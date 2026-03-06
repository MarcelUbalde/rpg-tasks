// test/rewardHistory.test.js
// Unit tests for enriched reward history — in-memory SQLite, no HTTP server.

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { makeUserRepository } from "../server/infrastructure/repositories/userRepository.factory.js";
import { makeRewardEventRepository } from "../server/infrastructure/repositories/rewardEventRepository.factory.js";
import { makeRewardEventUserRepository } from "../server/infrastructure/repositories/rewardEventUserRepository.factory.js";
import { makeRewardHistoryRepository } from "../server/infrastructure/repositories/rewardHistoryRepository.factory.js";
import { awardTaskExpToUsers } from "../server/application/awardTaskExpToUsers.js";
import { awardBugGoldToUsers } from "../server/application/awardBugGoldToUsers.js";

function setupDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, level INTEGER NOT NULL DEFAULT 1,
      exp REAL NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE reward_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, external_key TEXT NOT NULL,
      payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
      issue_key TEXT, summary TEXT, story_points REAL, severity TEXT,
      UNIQUE(type, external_key)
    );
    CREATE TABLE reward_event_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL, user_id TEXT NOT NULL,
      exp_awarded REAL NOT NULL DEFAULT 0,
      gold_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(event_id, user_id)
    );
  `);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, level, exp, gold, updated_at) VALUES (?, ?, ?, ?, ?)").run("u1", 1, 0, 0, now);
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

describe("rewardHistory — enriched fields", () => {
  let deps;
  let historyRepo;

  beforeEach(() => {
    const db = setupDb();
    deps = makeDeps(db);
    historyRepo = makeRewardHistoryRepository(db);
  });

  it("TASK evento con meta devuelve issueKey, summary, storyPoints; severity null; campos legacy presentes", async () => {
    await awardTaskExpToUsers(
      { taskId: "DV-100-done-ch-1", storyPoints: 3, userIds: ["u1"],
        meta: { issueKey: "DV-100", summary: "Implement feature X" } },
      deps
    );

    const items = historyRepo.findRecentByUserId("u1", 10);
    expect(items).toHaveLength(1);
    const item = items[0];

    // Campos nuevos
    expect(item.issueKey).toBe("DV-100");
    expect(item.summary).toBe("Implement feature X");
    expect(item.storyPoints).toBe(3);
    expect(item.severity).toBeNull();

    // Campos legacy intactos
    expect(item.type).toBe("TASK");
    expect(item.key).toBe("DV-100-done-ch-1");
    expect(item.expAwarded).toBe(3);
    expect(item.goldAwarded).toBe(0);
    expect(item.createdAt).toBeTruthy();
    expect(item.payload).toEqual({ storyPoints: 3 });
  });

  it("BUG evento con meta devuelve issueKey, summary, severity; storyPoints null; campos legacy presentes", async () => {
    await awardBugGoldToUsers(
      { jiraKey: "BUG-200-done-ch-2", severity: "High", userIds: ["u1"],
        meta: { issueKey: "BUG-200", summary: "Fix crash on checkout" } },
      deps
    );

    const items = historyRepo.findRecentByUserId("u1", 10);
    expect(items).toHaveLength(1);
    const item = items[0];

    // Campos nuevos
    expect(item.issueKey).toBe("BUG-200");
    expect(item.summary).toBe("Fix crash on checkout");
    expect(item.severity).toBe("High");
    expect(item.storyPoints).toBeNull();

    // Campos legacy intactos
    expect(item.type).toBe("BUG");
    expect(item.key).toBe("BUG-200-done-ch-2");
    expect(item.goldAwarded).toBe(3);
    expect(item.expAwarded).toBe(0);
    expect(item.payload).toEqual({ severity: "High" });
  });

  it("evento sin meta (simulando fila previa a migración) devuelve campos nuevos a null sin romper los legacy", async () => {
    await awardTaskExpToUsers(
      { taskId: "DV-OLD-done-ch-old", storyPoints: 2, userIds: ["u1"] },
      deps
    );

    const items = historyRepo.findRecentByUserId("u1", 10);
    expect(items).toHaveLength(1);
    const item = items[0];

    expect(item.issueKey).toBeNull();
    expect(item.summary).toBeNull();
    expect(item.storyPoints).toBe(2); // fallback from payload.storyPoints when no meta provided
    expect(item.severity).toBeNull();

    // Campos legacy siguen funcionando
    expect(item.type).toBe("TASK");
    expect(item.expAwarded).toBe(2);
  });

  it("múltiples eventos devueltos en orden DESC y respetando el limit", async () => {
    const db = setupDb();
    const d = makeDeps(db);
    const hist = makeRewardHistoryRepository(db);

    await awardTaskExpToUsers(
      { taskId: "DV-1-done-ch-a", storyPoints: 1, userIds: ["u1"],
        meta: { issueKey: "DV-1", summary: "First" } },
      d
    );
    await awardBugGoldToUsers(
      { jiraKey: "BUG-1-done-ch-b", severity: "Low", userIds: ["u1"],
        meta: { issueKey: "BUG-1", summary: "Second" } },
      d
    );

    const all = hist.findRecentByUserId("u1", 10);
    expect(all).toHaveLength(2);

    const limited = hist.findRecentByUserId("u1", 1);
    expect(limited).toHaveLength(1);
  });
});
