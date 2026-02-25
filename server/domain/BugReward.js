// server/domain/BugReward.js
// Pure function — no imports, no side effects.

const GOLD_MAP = { Low: 1, Medium: 2, High: 3, Critical: 5 };

export function goldForSeverity(severity) {
  if (!Object.prototype.hasOwnProperty.call(GOLD_MAP, severity)) {
    throw new Error(
      `Invalid severity: "${severity}". Allowed: Low, Medium, High, Critical`
    );
  }
  return GOLD_MAP[severity];
}
