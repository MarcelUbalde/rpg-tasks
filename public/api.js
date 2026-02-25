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
