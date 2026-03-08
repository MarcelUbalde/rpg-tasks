// server/routes/leaderboard.js

import { Router } from "express";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { asyncHandler } from "./asyncHandler.js";

export const leaderboardRouter = Router();

// Pure function — exported for unit tests
export function buildLeaderboard(rows) {
  return rows.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    level: u.level,
    exp: u.exp,
    gold: u.gold,
  }));
}

leaderboardRouter.get("/", asyncHandler(async (_req, res) => {
  const rows = await userRepository.findLeaderboard();
  res.json({ leaderboard: buildLeaderboard(rows) });
}));
