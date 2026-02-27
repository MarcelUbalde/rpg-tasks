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
  const findByIdStmt = db.prepare(
    `SELECT id, type, external_key, payload_json, created_at
     FROM reward_events WHERE id = @id`
  );
  const upsertStmt = db.prepare(
    `INSERT INTO reward_events (type, external_key, payload_json, created_at)
     VALUES (@type, @externalKey, @payloadJson, @createdAt)
     ON CONFLICT(type, external_key) DO UPDATE SET payload_json = excluded.payload_json`
  );
  return {
    // Immutable-by-key: INSERT OR IGNORE — if (type, key) exists, returns existing row unchanged (Create event flow).
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
    findById(eventId) {
      return findByIdStmt.get({ id: eventId }) ?? null;
    },
    // Mutable on purpose: ON CONFLICT DO UPDATE — overwrites payload_json so SP/severity reflect current input (Award dev/QA flow).
    upsertEvent({ type, externalKey, payload }) {
      upsertStmt.run({
        type,
        externalKey,
        payloadJson: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
      });
      return findStmt.get({ type, externalKey });
    },
  };
}
