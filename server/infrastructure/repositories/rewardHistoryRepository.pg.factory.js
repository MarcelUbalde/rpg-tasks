// server/infrastructure/repositories/rewardHistoryRepository.pg.factory.js
// Async Postgres reward history query repo.

import { getDb } from "../db.pg.js";
import { coerceNumeric } from "../pgNumeric.js";

export function makeRewardHistoryRepositoryPg() {
  return {
    async findRecentByUserId(userId, limit) {
      const { rows } = await getDb().query(
        `SELECT re.type,
                re.external_key,
                re.payload_json,
                re.issue_key,
                re.summary,
                re.story_points,
                re.severity,
                reu.exp_awarded,
                reu.gold_awarded,
                reu.created_at
         FROM reward_event_users reu
         JOIN reward_events re ON re.id = reu.event_id
         WHERE reu.user_id = $1
         ORDER BY reu.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return rows.map((row) => {
        let payload = null;
        try { payload = JSON.parse(row.payload_json); } catch { /* ignore */ }
        return {
          type: row.type,
          key: row.external_key,
          expAwarded: coerceNumeric(row.exp_awarded),
          goldAwarded: row.gold_awarded,
          createdAt: row.created_at,
          payload,
          issueKey: row.issue_key ?? null,
          summary: row.summary ?? null,
          storyPoints: row.story_points != null ? coerceNumeric(row.story_points) : null,
          severity: row.severity ?? null,
        };
      });
    },
  };
}
