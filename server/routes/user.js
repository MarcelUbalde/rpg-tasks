// server/routes/user.js

import { Router } from "express";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { getEvolutionStage } from "../domain/User.js";
import { asyncHandler } from "./asyncHandler.js";

export const userRouter = Router();

userRouter.get("/", asyncHandler(async (_req, res) => {
  const user = await userRepository.findById("local");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({
    id: user.id,
    level: user.level,
    exp: user.exp,
    gold: user.gold,
    evolutionStage: getEvolutionStage(user.level),
  });
}));
