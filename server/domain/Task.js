// server/domain/Task.js
// Task value object. Any task with storyPoints >= 1 grants EXP.
// SP validation (>= 1) is enforced at the route layer.

export function createTask(id, storyPoints) {
  return { id, storyPoints };
}
