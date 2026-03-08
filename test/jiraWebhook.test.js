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

const testConfig = {
  doneName: "Done",
  spField: "customfield_10009",
  severityField: "",
  developersField: "customfield_10819",
  qaField: "",
  userMap: { "jira-1": "u1" },
  bugIssueTypes:  new Set(["Error", "Defecto"]),
  taskIssueTypes: new Set(["Technical Story", "Historia", "Tarea"]),
};

// Helper: builds a minimal Jira issue_updated body for a TASK Done transition.
function makeTaskBody({ changelogId = "ch-1", status = "Done", issueKey = "HU-1", storyPoints = 3, accountId = "jira-1", qaAccountId = null, issueType = "Technical Story" } = {}) {
  return {
    issue: {
      key: issueKey,
      fields: {
        issuetype: { name: issueType },
        customfield_10009: storyPoints,
        customfield_10819: [{ accountId }],
        ...(qaAccountId ? { customfield_10818: { accountId: qaAccountId } } : {}),
      },
    },
    changelog: {
      id: changelogId,
      items: [{ field: "status", fromString: "In Progress", toString: status }],
    },
  };
}

// Helper: builds a minimal Jira body for a BUG Done transition (priority-based severity).
function makeBugBody({ changelogId = "ch-bug-1", status = "Done", issueKey = "BUG-1",
  priorityName = "Alta", issueType = "Error", accountId = "jira-1", qaAccountId = null } = {}) {
  return {
    issue: {
      key: issueKey,
      fields: {
        issuetype: { name: issueType },
        priority: { name: priorityName },
        customfield_10819: [{ accountId }],
        ...(qaAccountId ? { customfield_10818: { accountId: qaAccountId } } : {}),
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

  it("qaField empty — solo developers reciben EXP (retrocompatibilidad)", async () => {
    // qaAccountId presente en el body pero qaField no configurado → debe ignorarse
    const body = makeTaskBody({ changelogId: "ch-qa-off", storyPoints: 2, accountId: "jira-1", qaAccountId: "jira-qa" });
    const result = await handleJiraWebhook(body, testConfig, deps); // qaField: ""

    expect(result.recipientsResolved).toBe(1);
    expect(result.results[0]).toMatchObject({ userId: "u1", rewarded: true });
  });

  it("QA + developer distintos — ambos reciben EXP", async () => {
    const config = { ...testConfig, qaField: "customfield_10818", userMap: { "jira-1": "u1", "jira-qa": "u2" } };
    const body = makeTaskBody({ changelogId: "ch-qa-1", storyPoints: 3, accountId: "jira-1", qaAccountId: "jira-qa" });
    const result = await handleJiraWebhook(body, config, deps);

    expect(result.recipientsResolved).toBe(2);
    const u1 = result.results.find((r) => r.userId === "u1");
    const u2 = result.results.find((r) => r.userId === "u2");
    expect(u1).toMatchObject({ rewarded: true });
    expect(u2).toMatchObject({ rewarded: true });
  });

  it("QA == developer (mismo accountId) — EXP otorgada una sola vez", async () => {
    const config = { ...testConfig, qaField: "customfield_10818", userMap: { "jira-1": "u1" } };
    const body = makeTaskBody({ changelogId: "ch-qa-dup", storyPoints: 3, accountId: "jira-1", qaAccountId: "jira-1" });
    const result = await handleJiraWebhook(body, config, deps);

    expect(result.recipientsResolved).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ userId: "u1", rewarded: true });
  });

  it("QA presente pero no mapeado → en unmappedRecipients", async () => {
    const config = { ...testConfig, qaField: "customfield_10818", userMap: { "jira-1": "u1" } };
    const body = makeTaskBody({ changelogId: "ch-qa-unmap", storyPoints: 2, accountId: "jira-1", qaAccountId: "jira-unmapped" });
    const result = await handleJiraWebhook(body, config, deps);

    expect(result.recipientsResolved).toBe(1);
    expect(result.unmappedRecipients).toContain("jira-unmapped");
  });

  it("developers vacio + QA vacio → skipped (assignee no es fuente)", async () => {
    const config = { ...testConfig, qaField: "customfield_10818" };
    const body = {
      issue: {
        key: "HU-NO-PARTICIPANTS",
        fields: {
          issuetype: { name: "Technical Story" },
          customfield_10009: 3,
          assignee: { accountId: "jira-1" }, // presente pero ya no contribuye
        },
      },
      changelog: {
        id: "ch-no-part",
        items: [{ field: "status", fromString: "In Progress", toString: "Done" }],
      },
    };
    const result = await handleJiraWebhook(body, config, deps);

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_recipients");
  });

  it("BUG Done con developer + QA — ambos reciben oro (priority Alta → High = 3 gold)", async () => {
    const config = {
      ...testConfig,
      qaField: "customfield_10818",
      userMap: { "jira-1": "u1", "jira-qa": "u2" },
    };
    const body = makeBugBody({ changelogId: "ch-bug-qa", priorityName: "Alta", accountId: "jira-1", qaAccountId: "jira-qa" });
    const result = await handleJiraWebhook(body, config, deps);

    expect(result.recipientsResolved).toBe(2);
    const u1 = result.results.find((r) => r.userId === "u1");
    const u2 = result.results.find((r) => r.userId === "u2");
    // Alta → High → 3 gold
    expect(u1).toMatchObject({ rewarded: true, goldAwarded: 3 });
    expect(u2).toMatchObject({ rewarded: true, goldAwarded: 3 });
  });

  it("transición no-Done → skipped con reason no_done_transition", async () => {
    const body = makeTaskBody({ status: "In Progress" });
    const result = await handleJiraWebhook(body, testConfig, deps);
    expect(result).toEqual({ skipped: true, reason: "no_done_transition" });
  });

  it("changelog.id ausente → throws missing_changelog_id", async () => {
    const body = {
      issue: { key: "HU-1", fields: { issuetype: { name: "Technical Story" }, customfield_10009: 3 } },
      changelog: { items: [{ field: "status", fromString: "In Progress", toString: "Done" }] },
    };
    await expect(handleJiraWebhook(body, testConfig, deps))
      .rejects.toMatchObject({ code: "missing_changelog_id" });
  });

  it("TASK sin story points → throws missing_sp", async () => {
    const body = makeTaskBody({ storyPoints: null });
    await expect(handleJiraWebhook(body, testConfig, deps))
      .rejects.toMatchObject({ code: "missing_sp" });
  });

  it("BUG con priority desconocida → throws invalid_severity", async () => {
    const body = makeBugBody({ priorityName: "Desconocida" });
    await expect(handleJiraWebhook(body, testConfig, deps))
      .rejects.toMatchObject({ code: "invalid_severity" });
  });

  it("BUG tipo Error con priority Crítica → rewarded (gold = 5)", async () => {
    const body = makeBugBody({ changelogId: "ch-critica", issueType: "Error", priorityName: "Crítica" });
    const result = await handleJiraWebhook(body, testConfig, deps);
    expect(result.results[0]).toMatchObject({ userId: "u1", rewarded: true, goldAwarded: 5 });
  });

  it("BUG tipo Defecto con priority Media → rewarded (gold = 2)", async () => {
    const body = makeBugBody({ changelogId: "ch-defecto", issueType: "Defecto", priorityName: "Media" });
    const result = await handleJiraWebhook(body, testConfig, deps);
    expect(result.results[0]).toMatchObject({ userId: "u1", rewarded: true, goldAwarded: 2 });
  });

  it("TASK tipo Historia → rewarded with EXP", async () => {
    const body = makeTaskBody({ changelogId: "ch-historia", issueType: "Historia", storyPoints: 2 });
    const result = await handleJiraWebhook(body, testConfig, deps);
    expect(result.results[0]).toMatchObject({ userId: "u1", rewarded: true });
    // 2 EXP: L1→L2 (cost 1) → L2 con 1 EXP restante, no llega a L3 (cost 2)
    expect(result.results[0].newLevel).toBe(2);
  });

  it("issuetype no reconocido (Epic) → skipped con reason unsupported_issuetype", async () => {
    const body = {
      issue: {
        key: "EP-1",
        fields: {
          issuetype: { name: "Epic" },
          customfield_10009: 5,
          customfield_10819: [{ accountId: "jira-1" }],
        },
      },
      changelog: {
        id: "ch-epic",
        items: [{ field: "status", fromString: "In Progress", toString: "Done" }],
      },
    };
    const result = await handleJiraWebhook(body, testConfig, deps);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("unsupported_issuetype");
    expect(result.reason).not.toBe("no_done_transition");
  });
});
