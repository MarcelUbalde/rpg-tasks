// server/routes/dev.js
// Reset route — only mounted when NODE_ENV !== "production".

import { Router } from "express";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { rewardRepository } from "../infrastructure/repositories/rewardRepository.js";
import { logRepository } from "../infrastructure/repositories/logRepository.js";

export const devRouter = Router();

devRouter.post("/reset", (_req, res) => {
  userRepository.reset("local");
  rewardRepository.clear();
  logRepository.clear();
  res.json({ ok: true });
});
