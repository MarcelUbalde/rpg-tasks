// test/completeTask.test.js
// Unit tests for the completeTask use case using in-memory mock repos.
// No database dependency — tests run in pure JS.

import { describe, it, expect, beforeEach } from "vitest";
import { completeTask } from "../server/application/completeTask.js";

function makeUserRepo(initial = { id: "local", level: 1, exp: 0, gold: 0, updated_at: "" }) {
  let user = { ...initial };
  return {
    findById: () => ({ ...user }),
    save: (u) => { user = { ...u }; },
    _get: () => user,
  };
}

function makeRewardRepo(existing = []) {
  const ids = new Set(existing);
  return {
    existsById: (id) => ids.has(id),
    save: (r) => ids.add(r.id),
  };
}

function makeLogRepo() {
  let nextId = 1;
  return { save: (e) => ({ id: nextId++, ...e }) };
}

describe("completeTask", () => {
  let userRepo, rewardRepo, logRepo;

  beforeEach(() => {
    userRepo = makeUserRepo();
    rewardRepo = makeRewardRepo();
    logRepo = makeLogRepo();
  });

  it("SP=1 from level 1 exp 0 => level 2 exp 0", async () => {
    // gains 1, cost(1)=1 → level 2, exp 0
    const result = await completeTask(
      { taskId: "T-1", storyPoints: 1 },
      { userRepo, rewardRepo, logRepo }
    );
    expect(result.rewarded).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(result.newExp).toBe(0);
    expect(result.levelsGained).toBe(1);
    expect(result.logEntry.message).toBe("+1 nivel — T-1 (1 SP)");
  });

  it("SP=2 from level 2 exp 0 => level 3 exp 0", async () => {
    // gains 2, cost(2)=2 → level 3, exp 0
    userRepo = makeUserRepo({ id: "local", level: 2, exp: 0, gold: 0, updated_at: "" });
    const result = await completeTask(
      { taskId: "T-2", storyPoints: 2 },
      { userRepo, rewardRepo, logRepo }
    );
    expect(result.rewarded).toBe(true);
    expect(result.newLevel).toBe(3);
    expect(result.newExp).toBe(0);
    expect(result.levelsGained).toBe(1);
  });

  it("SP=2 from level 1 exp 0 => level 2 exp 1", async () => {
    // gains 2, cost(1)=1 → level 2, exp 1; cost(2)=2 > 1 → stop
    const result = await completeTask(
      { taskId: "T-3", storyPoints: 2 },
      { userRepo, rewardRepo, logRepo }
    );
    expect(result.rewarded).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(result.newExp).toBe(1);
    expect(result.levelsGained).toBe(1);
  });

  it("SP=8 from level 1 levels up multiple times", async () => {
    // gains 8: cost(1)=1→L2 exp=7; cost(2)=2→L3 exp=5; cost(3)=3→L4 exp=2; cost(4)=5>2 stop
    const result = await completeTask(
      { taskId: "T-big", storyPoints: 8 },
      { userRepo, rewardRepo, logRepo }
    );
    expect(result.rewarded).toBe(true);
    expect(result.newLevel).toBe(4);
    expect(result.newExp).toBe(2);
    expect(result.levelsGained).toBe(3);
    expect(result.logEntry.message).toBe("+3 niveles — T-big (8 SP)");
  });

  it("a duplicate task does not give reward", async () => {
    rewardRepo = makeRewardRepo(["T-dup"]);
    const result = await completeTask(
      { taskId: "T-dup", storyPoints: 5 },
      { userRepo, rewardRepo, logRepo }
    );
    expect(result.rewarded).toBe(false);
    expect(result.reason).toBe("duplicate");
    expect(userRepo._get().level).toBe(1);
  });
});
