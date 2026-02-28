// server/routes/log.js

import { Router } from "express";
import { logRepository } from "../infrastructure/repositories/logRepository.js";
import { asyncHandler } from "./asyncHandler.js";

export const logRouter = Router();

logRouter.get("/", asyncHandler(async (req, res) => {
  const raw = parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 10, 1), 100);
  res.json(await logRepository.findLatest(limit));
}));
