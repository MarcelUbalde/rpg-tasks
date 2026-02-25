// server/infrastructure/repositories/rewardEventUserRepository.factory.js
// No db import — safe to use in tests with any DatabaseSync instance.

export function makeRewardEventUserRepository(db) {
  const insertIgnoreStmt = db.prepare(
    `INSERT OR IGNORE INTO reward_event_users
       (event_id, user_id, exp_awarded, gold_awarded, created_at)
     VALUES (@eventId, @userId, @expAwarded, @goldAwarded, @createdAt)`
  );
  return {
    insertIfNotExists({ eventId, userId, expAwarded, goldAwarded, createdAt }) {
      const info = insertIgnoreStmt.run({ eventId, userId, expAwarded, goldAwarded, createdAt });
      return { inserted: info.changes > 0 };
    },
  };
}
