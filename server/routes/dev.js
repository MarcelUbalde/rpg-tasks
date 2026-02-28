// server/routes/dev.js
// Dev-only routes — only mounted when NODE_ENV !== "production".

import { Router } from "express";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { rewardRepository } from "../infrastructure/repositories/rewardRepository.js";
import { logRepository } from "../infrastructure/repositories/logRepository.js";
import { applyGoldGain } from "../domain/User.js";
import { awardTaskExpToUsers } from "../application/awardTaskExpToUsers.js";
import { awardBugGoldToUsers } from "../application/awardBugGoldToUsers.js";
import { createTaskRewardEvent } from "../application/createTaskRewardEvent.js";
import { createBugRewardEvent }  from "../application/createBugRewardEvent.js";
import { applyRewardEventToUsers } from "../application/applyRewardEventToUsers.js";
import { rewardEventRepository } from "../infrastructure/repositories/rewardEventRepository.js";
import { rewardEventUserRepository } from "../infrastructure/repositories/rewardEventUserRepository.js";
import { runInTransaction } from "../infrastructure/db.pg.js";

export const devRouter = Router();

devRouter.post("/reset", async (_req, res) => {
  await userRepository.reset("local");
  await rewardRepository.clear();
  await logRepository.clear();
  res.json({ ok: true });
});

const awardDeps = {
  userRepo: userRepository,
  rewardEventRepo: rewardEventRepository,
  rewardEventUserRepo: rewardEventUserRepository,
  transaction: runInTransaction,
};

const VALID_SEVERITIES = new Set(["Low", "Medium", "High", "Critical"]);

devRouter.post("/award-task", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { taskId, storyPoints, userIds } = req.body;
  if (typeof taskId !== "string" || !taskId) {
    return res.status(400).json({ error: "taskId must be a non-empty string" });
  }
  if (!Number.isInteger(storyPoints) || storyPoints <= 0) {
    return res.status(400).json({ error: "storyPoints must be a positive integer" });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds must be a non-empty array" });
  }
  try {
    res.json(await awardTaskExpToUsers({ taskId, storyPoints, userIds }, awardDeps));
  } catch (err) {
    if (err.code === "payload_mismatch") {
      return res.status(409).json({
        error: "payload_mismatch",
        type: err.type,
        key: err.externalKey,
        stored: err.storedPayload,
        requested: err.requestedPayload,
      });
    }
    if (err.code === "invariant_violation") {
      return res.status(500).json({
        error: "invariant_violation",
        type: err.type,
        key: err.externalKey,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

devRouter.post("/award-bug", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { jiraKey, severity, userIds } = req.body;
  if (typeof jiraKey !== "string" || !jiraKey) {
    return res.status(400).json({ error: "jiraKey must be a non-empty string" });
  }
  if (!VALID_SEVERITIES.has(severity)) {
    return res.status(400).json({ error: "severity must be one of: Low, Medium, High, Critical" });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds must be a non-empty array" });
  }
  try {
    res.json(await awardBugGoldToUsers({ jiraKey, severity, userIds }, awardDeps));
  } catch (err) {
    if (err.code === "payload_mismatch") {
      return res.status(409).json({
        error: "payload_mismatch",
        type: err.type,
        key: err.externalKey,
        stored: err.storedPayload,
        requested: err.requestedPayload,
      });
    }
    if (err.code === "invariant_violation") {
      return res.status(500).json({
        error: "invariant_violation",
        type: err.type,
        key: err.externalKey,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

devRouter.post("/jira/task-done", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { issueKey, storyPoints, doneEventId, userIds } = req.body;
  if (typeof issueKey !== "string" || !issueKey || !Number.isInteger(doneEventId) || doneEventId <= 0) {
    return res.status(400).json({ error: "issueKey must be a non-empty string and doneEventId must be a positive integer" });
  }
  if (!Number.isInteger(storyPoints) || storyPoints <= 0) {
    return res.status(400).json({ error: "storyPoints must be a positive integer" });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds must be a non-empty array" });
  }
  try {
    const externalKey = `${issueKey}-done-${doneEventId}`;
    res.json(await awardTaskExpToUsers({ taskId: externalKey, storyPoints, userIds }, awardDeps));
  } catch (err) {
    if (err.code === "payload_mismatch") {
      return res.status(409).json({
        error: "payload_mismatch",
        type: err.type,
        key: err.externalKey,
        stored: err.storedPayload,
        requested: err.requestedPayload,
      });
    }
    if (err.code === "invariant_violation") {
      return res.status(500).json({
        error: "invariant_violation",
        type: err.type,
        key: err.externalKey,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

devRouter.post("/create-task-event", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { taskId, storyPoints } = req.body;
  if (typeof taskId !== "string" || !taskId) {
    return res.status(400).json({ error: "taskId must be a non-empty string" });
  }
  if (!Number.isInteger(storyPoints) || storyPoints <= 0) {
    return res.status(400).json({ error: "storyPoints must be a positive integer" });
  }
  try {
    res.json(await createTaskRewardEvent({ taskId, storyPoints }, awardDeps));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

devRouter.post("/create-bug-event", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { jiraKey, severity } = req.body;
  if (typeof jiraKey !== "string" || !jiraKey) {
    return res.status(400).json({ error: "jiraKey must be a non-empty string" });
  }
  try {
    res.json(await createBugRewardEvent({ jiraKey, severity }, awardDeps));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

devRouter.post("/apply-event", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { eventId, userIds } = req.body;
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: "eventId must be a positive integer" });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds must be a non-empty array" });
  }
  try {
    res.json(await applyRewardEventToUsers({ eventId, userIds }, awardDeps));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

devRouter.post("/reset-multi", async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  await runInTransaction(async () => {
    for (const uid of ["u1", "u2"]) {
      await userRepository.reset(uid);
    }
    await rewardEventUserRepository.clearForUsers(["u1", "u2"]);
  });
  res.json({ ok: true });
});

devRouter.post("/add-gold", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { amount } = req.body;
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive integer" });
  }
  const user = await userRepository.findById("local");
  if (!user) return res.status(404).json({ error: "User not found" });
  const updated = applyGoldGain(user, amount);
  await userRepository.save(updated);
  res.json({ id: updated.id, level: updated.level, exp: updated.exp, gold: updated.gold });
});
