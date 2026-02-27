// server/application/userIds.js
// Shared helper: deduplicates a userIds array and throws if the result is empty.

export function deduplicateUserIds(userIds) {
  const unique = [...new Set(Array.isArray(userIds) ? userIds : [])];
  if (unique.length === 0) throw new Error("userIds must be a non-empty array");
  return unique;
}
