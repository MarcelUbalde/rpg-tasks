// server/routes/tasks.js
// Validates input, delegates to the completeTask use case.

import { Router } from "express";
import { completeTask } from "../application/completeTask.js";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { rewardRepository } from "../infrastructure/repositories/rewardRepository.js";
import { logRepository } from "../infrastructure/repositories/logRepository.js";

export const tasksRouter = Router();

// Repos object built once at module scope (not per-request).
const repos = {
  userRepo: userRepository,
  rewardRepo: rewardRepository,
  logRepo: logRepository,
};

tasksRouter.post("/complete", async (req, res, next) => {
  const { taskId, storyPoints } = req.body;

  if (!taskId || typeof taskId !== "string") {
    return res.status(400).json({ error: "taskId must be a non-empty string" });
  }
  if (typeof storyPoints !== "number" || storyPoints < 1) {
    return res.status(400).json({ error: "storyPoints must be a positive number" });
  }

  try {
    const result = await completeTask({ taskId, storyPoints }, repos);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
