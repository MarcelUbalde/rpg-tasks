// server/routes/activity.js

import { Router } from "express";
import { rewardHistoryRepository } from "../infrastructure/repositories/rewardHistoryRepository.js";
import { asyncHandler } from "./asyncHandler.js";

export const activityRouter = Router();

activityRouter.get("/", asyncHandler(async (req, res) => {
  const raw = req.query.limit !== undefined ? Number(req.query.limit) : 50;
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 200) : 50;
  const items = await rewardHistoryRepository.findRecent(limit);
  res.json({ items });
}));
