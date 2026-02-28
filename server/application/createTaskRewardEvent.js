// server/application/createTaskRewardEvent.js
// Creates (or retrieves) a TASK reward_event without touching any users.

export async function createTaskRewardEvent({ taskId, storyPoints }, { rewardEventRepo }) {
  if (!Number.isInteger(storyPoints) || storyPoints <= 0) {
    throw new Error("storyPoints must be a positive integer");
  }
  const raw = await rewardEventRepo.findOrCreateEvent({
    type: "TASK",
    externalKey: taskId,
    payload: { storyPoints },
  });
  return { event: { id: raw.id, type: "TASK", key: taskId } };
}
