// server/application/createTaskRewardEvent.js
// Creates (or retrieves) a TASK reward_event without touching any users.

export async function createTaskRewardEvent({ taskId, storyPoints }, { rewardEventRepo }) {
  const sp = Number(storyPoints);
  if (!Number.isFinite(sp) || sp <= 0) {
    throw new Error("storyPoints must be a positive number");
  }
  const raw = await rewardEventRepo.findOrCreateEvent({
    type: "TASK",
    externalKey: taskId,
    payload: { storyPoints: sp },
  });
  return { event: { id: raw.id, type: "TASK", key: taskId } };
}
