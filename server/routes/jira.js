// server/routes/jira.js
// Handles real Jira webhook events — mounted unconditionally at /api/jira.
// Authentication is enforced by the JIRA_WEBHOOK_SECRET ENV var.

import { Router } from "express";
import { asyncHandler } from "./asyncHandler.js";
import { handleJiraWebhook } from "../application/jira/handleJiraWebhook.js";
import { jiraConfig, isValidWebhookSecret } from "../config/jira.js";
import { userRepository } from "../infrastructure/repositories/userRepository.js";
import { rewardEventRepository } from "../infrastructure/repositories/rewardEventRepository.js";
import { rewardEventUserRepository } from "../infrastructure/repositories/rewardEventUserRepository.js";
import { runInTransaction } from "../infrastructure/db.pg.js";

export const jiraRouter = Router();

const deps = {
  userRepo: userRepository,
  rewardEventRepo: rewardEventRepository,
  rewardEventUserRepo: rewardEventUserRepository,
  transaction: runInTransaction,
};

const BAD_REQUEST_CODES = new Set([
  "missing_changelog_id",
  "missing_issue_key",
  "missing_sp",
  "invalid_sp",
  "sp_not_estimated",
  "invalid_severity",
  "severity_field_not_configured",
]);

function verifySecret(req, res, next) {
  if (!isValidWebhookSecret(req.headers["x-rpg-secret"], jiraConfig.secret)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

jiraRouter.post(
  "/webhook",
  verifySecret,
  asyncHandler(async (req, res) => {
    try {
      res.json(await handleJiraWebhook(req.body, jiraConfig, deps));
    } catch (err) {
      if (err.code === "payload_mismatch") {
        return res.status(409).json({
          error: "payload_mismatch",
          type: err.type,
          key: err.externalKey,
          stored: err.storedPayload,
          requested: err.requestedPayload,
        });
      }
      if (BAD_REQUEST_CODES.has(err.code)) {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      throw err;
    }
  })
);
