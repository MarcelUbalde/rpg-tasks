// server/application/createBugRewardEvent.js
// Creates (or retrieves) a BUG reward_event without touching any users.

import { goldForSeverity } from "../domain/BugReward.js";

export async function createBugRewardEvent({ jiraKey, severity }, { rewardEventRepo }) {
  goldForSeverity(severity); // throws on invalid severity — acts as validation
  const raw = await rewardEventRepo.findOrCreateEvent({
    type: "BUG",
    externalKey: jiraKey,
    payload: { severity },
  });
  return { event: { id: raw.id, type: "BUG", key: jiraKey } };
}
