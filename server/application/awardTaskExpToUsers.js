// server/application/awardTaskExpToUsers.js

import { applyExpGain } from "../domain/User.js";

export function awardTaskExpToUsers(
  { taskId, storyPoints, userIds },
  { userRepo, rewardEventRepo, rewardEventUserRepo, transaction }
) {
  if (!Number.isInteger(storyPoints) || storyPoints <= 0) {
    throw new Error("storyPoints must be a positive integer");
  }
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) {
    throw new Error("userIds must be a non-empty array");
  }

  return transaction(() => {
    const event = rewardEventRepo.findOrCreateEvent({
      type: "TASK",
      externalKey: taskId,
      payload: { storyPoints },
    });

    const results = [];
    for (const userId of uniqueIds) {
      // 1. Validate user exists FIRST — never lock a slot for a ghost user
      const user = userRepo.findById(userId);
      if (!user) {
        results.push({ userId, rewarded: false, reason: "user_not_found" });
        continue;
      }
      // 2. Claim the slot via UNIQUE constraint
      const { inserted } = rewardEventUserRepo.insertIfNotExists({
        eventId: event.id,
        userId,
        expAwarded: storyPoints,
        goldAwarded: 0,
        createdAt: new Date().toISOString(),
      });
      if (!inserted) {
        results.push({ userId, rewarded: false, reason: "duplicate" });
        continue;
      }
      // 3. Apply domain gain and persist
      // Safe pattern: handles both { updatedUser, levelsGained } and plain-user return shapes
      const r = applyExpGain(user, storyPoints);
      let updatedUser, levelsGained;
      if (r && typeof r === "object" && "updatedUser" in r) {
        updatedUser = r.updatedUser;
        levelsGained = r.levelsGained;
      } else {
        updatedUser = r;
        levelsGained = updatedUser.level - user.level;
      }
      userRepo.save(updatedUser);
      results.push({
        userId,
        rewarded: true,
        newLevel: updatedUser.level,
        newExp: updatedUser.exp,
        levelsGained,
      });
    }

    return { event: { type: "TASK", key: taskId }, results };
  });
}
