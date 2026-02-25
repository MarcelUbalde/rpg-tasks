// server/routes/dev.js
// Dev-only routes — only mounted when NODE_ENV !== "production".

import { Router } from "express";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { rewardRepository } from "../infrastructure/repositories/rewardRepository.js";
import { logRepository } from "../infrastructure/repositories/logRepository.js";
import { applyGoldGain } from "../domain/User.js";

export const devRouter = Router();

devRouter.post("/reset", (_req, res) => {
  userRepository.reset("local");
  rewardRepository.clear();
  logRepository.clear();
  res.json({ ok: true });
});

devRouter.post("/add-gold", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint disabled in production" });
  }
  const { amount } = req.body;
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive integer" });
  }
  const user = userRepository.findById("local");
  if (!user) return res.status(404).json({ error: "User not found" });
  const updated = applyGoldGain(user, amount);
  userRepository.save(updated);
  res.json({ id: updated.id, level: updated.level, exp: updated.exp, gold: updated.gold });
});
