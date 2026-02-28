// server/infrastructure/repositories/rewardEventUserRepository.pg.factory.js
// Async Postgres reward event user repo.
// insertIfNotExists is the idempotency gate for per-user awards.

import { getDb } from "../db.pg.js";

export function makeRewardEventUserRepositoryPg() {
  return {
    async insertIfNotExists({ eventId, userId, expAwarded, goldAwarded, createdAt }) {
      const db = getDb();
      const { rowCount } = await db.query(
        `INSERT INTO reward_event_users (event_id, user_id, exp_awarded, gold_awarded, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id, user_id) DO NOTHING`,
        [eventId, userId, expAwarded, goldAwarded, createdAt]
      );
      return { inserted: rowCount > 0 };
    },

    // Used by /api/dev/reset-multi — replaces the direct db.prepare().run() call.
    async clearForUsers(userIds) {
      if (!userIds || userIds.length === 0) return;
      const db = getDb();
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
      await db.query(
        `DELETE FROM reward_event_users WHERE user_id IN (${placeholders})`,
        userIds
      );
    },
  };
}
