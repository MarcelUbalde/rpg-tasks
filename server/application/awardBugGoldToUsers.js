// server/application/awardBugGoldToUsers.js
// Award flow: upsert overwrites payload_json so severity always matches current input (dev/QA intent).

import { applyRewardEventToUsers } from "./applyRewardEventToUsers.js";
import { goldForSeverity } from "../domain/BugReward.js";
import { deduplicateUserIds } from "./userIds.js";

export function awardBugGoldToUsers({ jiraKey, severity, userIds }, deps) {
  goldForSeverity(severity); // throws on invalid severity
  const uniqueIds = deduplicateUserIds(userIds);
  const raw = deps.rewardEventRepo.upsertEvent({
    type: "BUG",
    externalKey: jiraKey,
    payload: { severity },
  });
  return applyRewardEventToUsers({ eventId: raw.id, userIds: uniqueIds }, deps);
}
