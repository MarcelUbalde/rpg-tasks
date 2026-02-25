// server/application/awardBugGoldToUsers.js

import { applyGoldGain } from "../domain/User.js";
import { goldForSeverity } from "../domain/BugReward.js";

export function awardBugGoldToUsers(
  { jiraKey, severity, userIds },
  { userRepo, rewardEventRepo, rewardEventUserRepo, transaction }
) {
  const gold = goldForSeverity(severity); // throws on invalid severity
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) {
    throw new Error("userIds must be a non-empty array");
  }

  return transaction(() => {
    const event = rewardEventRepo.findOrCreateEvent({
      type: "BUG",
      externalKey: jiraKey,
      payload: { severity },
    });

    const results = [];
    for (const userId of uniqueIds) {
      // 1. Validate user exists first
      const user = userRepo.findById(userId);
      if (!user) {
        results.push({ userId, rewarded: false, reason: "user_not_found" });
        continue;
      }
      // 2. Claim slot
      const { inserted } = rewardEventUserRepo.insertIfNotExists({
        eventId: event.id,
        userId,
        expAwarded: 0,
        goldAwarded: gold,
        createdAt: new Date().toISOString(),
      });
      if (!inserted) {
        results.push({ userId, rewarded: false, reason: "duplicate" });
        continue;
      }
      // 3. Apply and persist
      const updatedUser = applyGoldGain(user, gold);
      userRepo.save(updatedUser);
      results.push({
        userId,
        rewarded: true,
        newGold: updatedUser.gold,
        goldAwarded: gold,
      });
    }

    return { event: { type: "BUG", key: jiraKey }, results };
  });
}
