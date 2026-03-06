// server/application/awardTaskExpToUsers.js
// Award flow: event is immutable — same key + same SP is idempotent; different SP → payload_mismatch.
// Jira integration note: externalKey (taskId) defines the immutability boundary.
// A key cannot be re-awarded with a changed storyPoints value.
// If SP may change (e.g., re-estimation per sprint), version the key: `${taskId}-${sprintId}`.

import { applyRewardEventToUsers } from "./applyRewardEventToUsers.js";
import { deduplicateUserIds } from "./userIds.js";

export async function awardTaskExpToUsers({ taskId, storyPoints, userIds, meta }, deps) {
  if (!Number.isFinite(storyPoints) || storyPoints <= 0) {
    throw new Error("storyPoints must be a positive number");
  }
  const uniqueIds = deduplicateUserIds(userIds);
  const raw = await deps.rewardEventRepo.assertSameOrCreate({
    type: "TASK",
    externalKey: taskId,
    payload: { storyPoints },
    meta,
  });
  return applyRewardEventToUsers({ eventId: raw.id, userIds: uniqueIds }, deps);
}
