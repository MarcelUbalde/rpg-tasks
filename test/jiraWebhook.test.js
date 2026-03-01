// test/jiraWebhook.test.js
// Integration tests for the Jira webhook flow — in-memory SQLite, no HTTP server.

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { makeUserRepository } from "../server/infrastructure/repositories/userRepository.factory.js";
import { makeRewardEventRepository } from "../server/infrastructure/repositories/rewardEventRepository.factory.js";
import { makeRewardEventUserRepository } from "../server/infrastructure/repositories/rewardEventUserRepository.factory.js";
import { handleJiraWebhook } from "../server/application/jira/handleJiraWebhook.js";
import { isValidWebhookSecret } from "../server/config/jira.js";

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
  const ins = db.prepare("INSERT INTO users (id, level, exp, gold, updated_at) VALUES (?, ?, ?, ?, ?)");
  ins.run("u1", 1, 0, 0, now);
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

const testConfig = {
  doneName: "Done",
  spField: "customfield_10009",
  severityField: "",
  developersField: "customfield_10819",
  userMap: { "jira-1": "u1" },
};

// Helper: builds a minimal Jira issue_updated body for a TASK Done transition.
function makeTaskBody({ changelogId = "ch-1", status = "Done", issueKey = "HU-1", storyPoints = 3, accountId = "jira-1" } = {}) {
  return {
    issue: {
      key: issueKey,
      fields: {
        issuetype: { name: "Story" },
        customfield_10009: storyPoints,
        assignee: { accountId },
      },
    },
    changelog: {
      id: changelogId,
      items: [{ field: "status", fromString: "In Progress", toString: status }],
    },
  };
}

describe("jiraWebhook", () => {
  let deps;

  beforeEach(() => { deps = makeDeps(setupDb()); });

  it("rejects invalid webhook secret", () => {
    expect(isValidWebhookSecret("wrong", "correct")).toBe(false);
    expect(isValidWebhookSecret(undefined, "correct")).toBe(false);
    expect(isValidWebhookSecret("correct", "")).toBe(false);
    expect(isValidWebhookSecret("correct", "correct")).toBe(true);
  });

  it("TASK Done with SP rewards user and applies EXP", async () => {
    const body = makeTaskBody({ changelogId: "ch-1", storyPoints: 3, accountId: "jira-1" });
    const result = await handleJiraWebhook(body, testConfig, deps);

    expect(result.recipientsResolved).toBe(1);
    expect(result.unmappedRecipients).toEqual([]);
    // 3 EXP from L1: costs 1 (L1→L2) + 2 (L2→L3) = 3 → newLevel 3
    expect(result.results[0]).toMatchObject({ userId: "u1", rewarded: true, newLevel: 3, levelsGained: 2 });
  });

  it("replay of same webhook is idempotent — no double reward", async () => {
    const body = makeTaskBody({ changelogId: "ch-2", storyPoints: 3 });
    await handleJiraWebhook(body, testConfig, deps);
    const r2 = await handleJiraWebhook(body, testConfig, deps);

    expect(r2.results[0]).toMatchObject({ userId: "u1", rewarded: false, reason: "duplicate" });
  });

  it("decimal SP (2.5) preserves precision — exp = 1.5 without truncation", async () => {
    const body = makeTaskBody({ changelogId: "ch-dec", storyPoints: 2.5 });
    const result = await handleJiraWebhook(body, testConfig, deps);

    // 2.5 EXP from L1: L1→L2 costs 1 (exp=1.5), L2→L3 costs 2 (1.5 < 2 → no level up)
    expect(result.results[0]).toMatchObject({ userId: "u1", rewarded: true, newLevel: 2, levelsGained: 1 });

    const user = deps.db.prepare("SELECT exp FROM users WHERE id = ?").get("u1");
    expect(user.exp).toBe(1.5);
  });

  it("same changelog.id with different SP → payload_mismatch", async () => {
    const body1 = makeTaskBody({ changelogId: "ch-99", storyPoints: 3 });
    await handleJiraWebhook(body1, testConfig, deps);

    const body2 = makeTaskBody({ changelogId: "ch-99", storyPoints: 5 });
    await expect(handleJiraWebhook(body2, testConfig, deps))
      .rejects.toMatchObject({ code: "payload_mismatch" });
  });
});
