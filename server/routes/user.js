// server/routes/user.js

import { Router } from "express";
import { userRepository } from "../infrastructure/repositories/userRepository.js";

export const userRouter = Router();

userRouter.get("/", (_req, res) => {
  const user = userRepository.findById("local");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ id: user.id, level: user.level, exp: user.exp, gold: user.gold });
});
