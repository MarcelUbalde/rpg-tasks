// server/routes/users.js

import { Router } from "express";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { getEvolutionStage } from "../domain/User.js";
import { asyncHandler } from "./asyncHandler.js";

export const usersRouter = Router();

usersRouter.get("/", asyncHandler(async (_req, res) => {
  const users = await userRepository.findAll();
  res.json(
    users.map((u) => ({
      id: u.id,
      level: u.level,
      exp: u.exp,
      gold: u.gold,
      evolutionStage: getEvolutionStage(u.level),
    }))
  );
}));
