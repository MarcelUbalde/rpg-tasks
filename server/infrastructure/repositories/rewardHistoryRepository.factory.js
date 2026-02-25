// server/infrastructure/repositories/rewardHistoryRepository.factory.js
// No db import — safe to use in tests with any DatabaseSync instance.

export function makeRewardHistoryRepository(db) {
  const stmt = db.prepare(`
    SELECT re.type,
           re.external_key,
           re.payload_json,
           reu.exp_awarded,
           reu.gold_awarded,
           reu.created_at
    FROM reward_event_users reu
    JOIN reward_events re ON re.id = reu.event_id
    WHERE reu.user_id = ?
    ORDER BY reu.created_at DESC
    LIMIT ?
  `);

  return {
    findRecentByUserId(userId, limit) {
      return stmt.all(userId, limit).map((row) => {
        let payload = null;
        try { payload = JSON.parse(row.payload_json); } catch { /* ignore */ }
        return {
          type: row.type,
          key: row.external_key,
          expAwarded: row.exp_awarded,
          goldAwarded: row.gold_awarded,
          createdAt: row.created_at,
          payload,
        };
      });
    },
  };
}
