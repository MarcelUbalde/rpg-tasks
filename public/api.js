// public/api.js
// Fetch wrappers for the RPG Tasks API.

const BASE = "/api";

export async function getUser() {
  const res = await fetch(`${BASE}/user`);
  if (!res.ok) throw new Error(`getUser failed: ${res.status}`);
  return res.json();
}

export async function completeTask(taskId, storyPoints) {
  const res = await fetch(`${BASE}/tasks/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, storyPoints }),
  });
  if (!res.ok) throw new Error(`completeTask failed: ${res.status}`);
  return res.json();
}

export async function getLog(limit = 10) {
  const res = await fetch(`${BASE}/log?limit=${limit}`);
  if (!res.ok) throw new Error(`getLog failed: ${res.status}`);
  return res.json();
}

export async function devReset() {
  const res = await fetch(`${BASE}/dev/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`devReset failed: ${res.status}`);
  return res.json();
}

export async function addGold(amount) {
  const res = await fetch(`${BASE}/dev/add-gold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error(`addGold failed: ${res.status}`);
  return res.json();
}

export async function getUsers() {
  const res = await fetch(`${BASE}/users`);
  if (!res.ok) throw new Error(`getUsers failed: ${res.status}`);
  return res.json();
}

export async function awardTask(taskId, storyPoints, userIds) {
  const res = await fetch(`${BASE}/dev/award-task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, storyPoints, userIds }),
  });
  if (!res.ok) throw new Error(`awardTask failed: ${res.status}`);
  return res.json();
}

export async function awardBug(jiraKey, severity, userIds) {
  const res = await fetch(`${BASE}/dev/award-bug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jiraKey, severity, userIds }),
  });
  if (!res.ok) throw new Error(`awardBug failed: ${res.status}`);
  return res.json();
}

export async function resetMulti() {
  const res = await fetch(`${BASE}/dev/reset-multi`, { method: "POST" });
  if (!res.ok) throw new Error(`resetMulti failed: ${res.status}`);
  return res.json();
}

export async function getUserRewards(userId, limit = 20) {
  const res = await fetch(`${BASE}/users/${encodeURIComponent(userId)}/rewards?limit=${limit}`);
  if (!res.ok) throw new Error(`getUserRewards failed: ${res.status}`);
  return res.json();
}
