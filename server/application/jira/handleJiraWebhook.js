// server/application/jira/handleJiraWebhook.js
// Use case: orchestrates Jira Done webhook → reward event creation → user rewards.
// Reuses existing awardTaskExpToUsers / awardBugGoldToUsers (idempotent by externalKey).

import { parseJiraDoneEvent } from "./parseJiraDoneEvent.js";
import { resolveRecipientUserIds } from "./resolveRecipientUserIds.js";
import { awardTaskExpToUsers } from "../awardTaskExpToUsers.js";
import { awardBugGoldToUsers } from "../awardBugGoldToUsers.js";

// Local structured logger — console.warn for skipped events, console.log for normal flow.
function logJiraWebhook(event, payload = {}) {
  const line = JSON.stringify({ event, ...payload });
  if (event === "skipped") console.warn("[jira webhook]", line);
  else console.log("[jira webhook]", line);
}

// CC=4.
export async function handleJiraWebhook(body, config, deps) {
  const issueKey = body?.issue?.key ?? "unknown";
  logJiraWebhook("received", { issueKey });

  let parsed;
  try {
    parsed = parseJiraDoneEvent(body, config);
  } catch (e) {
    if (e.code === "unsupported_issuetype") {
      logJiraWebhook("skipped", { issueKey, reason: "unsupported_issuetype", issueType: body?.issue?.fields?.issuetype?.name });
      return { skipped: true, reason: "unsupported_issuetype" };
    }
    throw e;
  }
  if (!parsed) {
    logJiraWebhook("skipped", { issueKey, reason: "no_done_transition" });
    return { skipped: true, reason: "no_done_transition" };
  }

  const { userIds, unmappedRecipients } = resolveRecipientUserIds(
    body, config.userMap, config.developersField, config.qaField
  );
  logJiraWebhook("recipients_resolved", { issueKey, type: parsed.type, userIds, unmappedRecipients });

  if (userIds.length === 0) {
    logJiraWebhook("skipped", { issueKey, reason: "no_recipients", unmappedRecipients });
    return { skipped: true, reason: "no_recipients", unmappedRecipients };
  }

  const meta = { issueKey: parsed.issueKey, summary: parsed.summary };
  const result = parsed.type === "TASK"
    ? await awardTaskExpToUsers(
        { taskId: parsed.externalKey, storyPoints: parsed.payload.storyPoints, userIds, meta }, deps)
    : await awardBugGoldToUsers(
        { jiraKey: parsed.externalKey, severity: parsed.payload.severity, userIds, meta }, deps);

  logJiraWebhook("rewarded", {
    issueKey,
    type: parsed.type,
    externalKey: parsed.externalKey,
    results: result.results.map((r) => ({ userId: r.userId, rewarded: r.rewarded, reason: r.reason ?? null })),
  });

  return {
    event: result.event,
    recipientsResolved: userIds.length,
    unmappedRecipients,
    results: result.results,
  };
}
