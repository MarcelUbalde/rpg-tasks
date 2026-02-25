// server/domain/User.js
// Pure functions — no imports, no side effects.

export function createUser(id) {
  return { id, level: 1, exp: 0, gold: 0, updated_at: new Date().toISOString() };
}

// Cost (EXP) to advance from `level` to `level+1`.
// Sequence: 1→2 costs 1, 2→3 costs 2, 3→4 costs 3, 4→5 costs 5, 5→6 costs 8 ...
// F(1)=1, F(2)=2, F(n) = F(n-1) + F(n-2)
export function levelUpCost(level) {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  let a = 1, b = 2;
  for (let i = 3; i <= level; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

// Apply EXP gain, handling multi-level-ups.
// Returns { updatedUser, levelsGained }.
export function applyExpGain(user, expGained) {
  let { level, exp } = user;
  exp += expGained;
  let levelsGained = 0;
  let cost = levelUpCost(level);
  while (exp >= cost) {
    exp -= cost;
    level++;
    levelsGained++;
    cost = levelUpCost(level);
  }
  const updatedUser = { ...user, level, exp, updated_at: new Date().toISOString() };
  return { updatedUser, levelsGained };
}

// Returns evolution stage (0–5) based on level.
// Stage 0: L1–2, Stage 1: L3–4, ..., Stage 5: L11+
export function getEvolutionStage(level) {
  return Math.min(5, Math.floor((level - 1) / 2));
}

// Returns updated user with gold incremented and updated_at refreshed. No side effects.
export function applyGoldGain(user, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount must be a positive integer");
  }
  return { ...user, gold: user.gold + amount, updated_at: new Date().toISOString() };
}

// Returns a color key based on level thresholds.
// level 1=gray, 2-3=green, 4-5=blue, 6-7=purple, 8+=gold
export function getAvatarColor(level) {
  if (level < 2) return "gray";
  if (level < 4) return "green";
  if (level < 6) return "blue";
  if (level < 8) return "purple";
  return "gold";
}
