// server/application/applyRewardEventToUsers.js
// Applies an existing reward_event to a set of users, idempotent per (event, user) pair.

import { applyExpGain, applyGoldGain } from "../domain/User.js";
import { goldForSeverity } from "../domain/BugReward.js";
import { deduplicateUserIds } from "./userIds.js";

// Resolves expAwarded/goldAwarded from event type + payload. CC=2.
function computeAmounts(eventType, payload) {
  if (eventType === "TASK") return { expAwarded: payload.storyPoints, goldAwarded: 0 };
  return { expAwarded: 0, goldAwarded: goldForSeverity(payload.severity) };
}

// Parses payload_json with controlled error. CC=2.
function parsePayload(payloadJson, eventId) {
  try {
    return JSON.parse(payloadJson);
  } catch {
    throw new Error(`invalid payload_json for event ${eventId}`);
  }
}

// Applies a single event to one user, returns per-user result. CC=3.
async function applyToUser(event, payload, user, rewardEventUserRepo, userRepo) {
  const { expAwarded, goldAwarded } = computeAmounts(event.type, payload);
  const { inserted } = await rewardEventUserRepo.insertIfNotExists({
    eventId: event.id,
    userId: user.id,
    expAwarded,
    goldAwarded,
    createdAt: new Date().toISOString(),
  });
  if (!inserted) return { userId: user.id, rewarded: false, reason: "duplicate" };
  if (event.type === "TASK") {
    const { updatedUser, levelsGained } = applyExpGain(user, expAwarded);
    await userRepo.save(updatedUser);
    return { userId: user.id, rewarded: true, newLevel: updatedUser.level, newExp: updatedUser.exp, levelsGained };
  }
  const updated = applyGoldGain(user, goldAwarded);
  await userRepo.save(updated);
  return { userId: user.id, rewarded: true, goldAwarded, newGold: updated.gold };
}

// Main use case. CC=5.
export async function applyRewardEventToUsers(
  { eventId, userIds },
  { userRepo, rewardEventRepo, rewardEventUserRepo, transaction }
) {
  if (!eventId) throw new Error("eventId required");
  const uniqueIds = deduplicateUserIds(userIds);

  return transaction(async () => {
    const event = await rewardEventRepo.findById(eventId);
    if (!event) throw new Error(`event not found: ${eventId}`);
    const payload = parsePayload(event.payload_json, eventId);

    const results = [];
    for (const userId of uniqueIds) {
      const user = await userRepo.findById(userId);
      if (!user) { results.push({ userId, rewarded: false, reason: "user_not_found" }); continue; }
      results.push(await applyToUser(event, payload, user, rewardEventUserRepo, userRepo));
    }
    return { event: { id: event.id, type: event.type, key: event.external_key }, results };
  });
}
