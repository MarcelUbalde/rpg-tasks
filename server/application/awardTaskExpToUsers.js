// server/application/awardTaskExpToUsers.js
// Award flow: upsert overwrites payload_json so SP always matches current input (dev/QA intent).

import { applyRewardEventToUsers } from "./applyRewardEventToUsers.js";
import { deduplicateUserIds } from "./userIds.js";

export function awardTaskExpToUsers({ taskId, storyPoints, userIds }, deps) {
  if (!Number.isInteger(storyPoints) || storyPoints <= 0) {
    throw new Error("storyPoints must be a positive integer");
  }
  const uniqueIds = deduplicateUserIds(userIds);
  const raw = deps.rewardEventRepo.upsertEvent({
    type: "TASK",
    externalKey: taskId,
    payload: { storyPoints },
  });
  return applyRewardEventToUsers({ eventId: raw.id, userIds: uniqueIds }, deps);
}
