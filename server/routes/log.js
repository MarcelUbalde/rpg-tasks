// server/routes/log.js

import { Router } from "express";
import { logRepository } from "../infrastructure/repositories/logRepository.js";

export const logRouter = Router();

logRouter.get("/", (req, res) => {
  const raw = parseInt(req.query.limit, 10);
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 10, 1), 100);
  res.json(logRepository.findLatest(limit));
});
