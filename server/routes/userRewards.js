// server/routes/userRewards.js

import { Router } from "express";
import { rewardHistoryRepository } from "../infrastructure/repositories/rewardHistoryRepository.js";

export const userRewardsRouter = Router();

userRewardsRouter.get("/:userId/rewards", (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const raw = req.query.limit !== undefined ? Number(req.query.limit) : 20;
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 100) : 20;
  const items = rewardHistoryRepository.findRecentByUserId(userId, limit);
  res.json({ userId, items });
});
