// server/application/completeTask.js
// Use case: orchestrates the task-completion reward flow.
// Repos are injected — enabling unit tests with zero DB dependency.

import { createTask } from "../domain/Task.js";
import { processReward } from "../domain/RewardService.js";

export async function completeTask({ taskId, storyPoints }, { userRepo, rewardRepo, logRepo }) {
  if (await rewardRepo.existsById(taskId)) {
    return { rewarded: false, reason: "duplicate" };
  }

  const user = await userRepo.findById("local");
  const task = createTask(taskId, storyPoints);
  const result = processReward(user, task);

  await userRepo.save(result.updatedUser);
  await rewardRepo.save({
    id: taskId,
    user_id: "local",
    story_points: storyPoints,
    rewarded_at: new Date().toISOString(),
  });
  const logEntry = await logRepo.save({
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
