// server/application/jira/handleJiraWebhook.js
// Use case: orchestrates Jira Done webhook → reward event creation → user rewards.
// Reuses existing awardTaskExpToUsers / awardBugGoldToUsers (idempotent by externalKey).

import { parseJiraDoneEvent } from "./parseJiraDoneEvent.js";
import { resolveRecipientUserIds } from "./resolveRecipientUserIds.js";
import { awardTaskExpToUsers } from "../awardTaskExpToUsers.js";
import { awardBugGoldToUsers } from "../awardBugGoldToUsers.js";

// CC=4.
export async function handleJiraWebhook(body, config, deps) {
  const parsed = parseJiraDoneEvent(body, config);
  if (!parsed) return { skipped: true, reason: "no_done_transition" };

  const { userIds, unmappedRecipients } = resolveRecipientUserIds(
    body, config.userMap, config.developersField, config.qaField
  );
  if (userIds.length === 0) return { skipped: true, reason: "no_recipients", unmappedRecipients };

  const meta = { issueKey: parsed.issueKey, summary: parsed.summary };
  const result = parsed.type === "TASK"
    ? await awardTaskExpToUsers(
        { taskId: parsed.externalKey, storyPoints: parsed.payload.storyPoints, userIds, meta }, deps)
    : await awardBugGoldToUsers(
        { jiraKey: parsed.externalKey, severity: parsed.payload.severity, userIds, meta }, deps);

  return {
    event: result.event,
    recipientsResolved: userIds.length,
    unmappedRecipients,
    results: result.results,
  };
}
