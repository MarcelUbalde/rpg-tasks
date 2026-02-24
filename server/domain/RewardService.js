// server/domain/RewardService.js
// Core reward logic — pure function, no side effects.
// Any task with storyPoints >= 1 grants EXP = storyPoints.

import { applyExpGain } from "./User.js";

function buildLogMessage(taskId, storyPoints, levelsGained) {
  if (levelsGained === 0) {
    return `+${storyPoints} EXP — ${taskId} (${storyPoints} SP)`;
  }
  const noun = levelsGained === 1 ? "nivel" : "niveles";
  return `+${levelsGained} ${noun} — ${taskId} (${storyPoints} SP)`;
}

export function processReward(user, task) {
  const { updatedUser, levelsGained } = applyExpGain(user, task.storyPoints);
  const logMessage = buildLogMessage(task.id, task.storyPoints, levelsGained);
  return { rewarded: true, updatedUser, levelsGained, logMessage };
}
