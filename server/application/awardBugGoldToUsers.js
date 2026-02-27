// server/application/awardBugGoldToUsers.js
// Award flow: event is immutable — same key + same severity is idempotent; different severity → payload_mismatch.
// Jira integration note: externalKey (jiraKey) defines the immutability boundary.
// A key cannot be re-awarded with a changed severity value.
// If severity may change after initial triage, version the key: `${jiraKey}-v2`.

import { applyRewardEventToUsers } from "./applyRewardEventToUsers.js";
import { goldForSeverity } from "../domain/BugReward.js";
import { deduplicateUserIds } from "./userIds.js";

export function awardBugGoldToUsers({ jiraKey, severity, userIds }, deps) {
  goldForSeverity(severity); // throws on invalid severity
  const uniqueIds = deduplicateUserIds(userIds);
  const raw = deps.rewardEventRepo.assertSameOrCreate({
    type: "BUG",
    externalKey: jiraKey,
    payload: { severity },
  });
  return applyRewardEventToUsers({ eventId: raw.id, userIds: uniqueIds }, deps);
}
