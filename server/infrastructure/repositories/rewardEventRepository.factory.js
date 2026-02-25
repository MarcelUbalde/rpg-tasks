// server/infrastructure/repositories/rewardEventRepository.factory.js
// No db import — safe to use in tests with any DatabaseSync instance.

export function makeRewardEventRepository(db) {
  const insertIgnoreStmt = db.prepare(
    `INSERT OR IGNORE INTO reward_events (type, external_key, payload_json, created_at)
     VALUES (@type, @externalKey, @payloadJson, @createdAt)`
  );
  const findStmt = db.prepare(
    `SELECT id, type, external_key, payload_json, created_at
     FROM reward_events WHERE type = @type AND external_key = @externalKey`
  );
  return {
    findOrCreateEvent({ type, externalKey, payload }) {
      insertIgnoreStmt.run({
        type,
        externalKey,
        payloadJson: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
      });
      return findStmt.get({ type, externalKey });
    },
    findByTypeAndKey(type, externalKey) {
      return findStmt.get({ type, externalKey }) ?? null;
    },
  };
}
