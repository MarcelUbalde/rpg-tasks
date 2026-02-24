// server/application/completeTask.js
// Use case: orchestrates the task-completion reward flow.
// Repos are injected — enabling unit tests with zero DB dependency.

import { createTask } from "../domain/Task.js";
import { processReward } from "../domain/RewardService.js";

export function completeTask({ taskId, storyPoints }, { userRepo, rewardRepo, logRepo }) {
  if (rewardRepo.existsById(taskId)) {
    return { rewarded: false, reason: "duplicate" };
  }

  const user = userRepo.findById("local");
  const task = createTask(taskId, storyPoints);
  const result = processReward(user, task);

  userRepo.save(result.updatedUser);
  rewardRepo.save({
    id: taskId,
    user_id: "local",
    story_points: storyPoints,
    rewarded_at: new Date().toISOString(),
  });
  const logEntry = logRepo.save({
    user_id: "local",
    message: result.logMessage,
    created_at: new Date().toISOString(),
  });

  return {
    rewarded: true,
    newLevel: result.updatedUser.level,
    newExp: result.updatedUser.exp,
    levelsGained: result.levelsGained,
    logEntry,
  };
}
