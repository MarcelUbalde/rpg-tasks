// server/infrastructure/repositories/rewardRepository.js

import { getDb } from "../db.pg.js";

export const rewardRepository = {
  async existsById(id) {
    const { rows } = await getDb().query(
      "SELECT id FROM rewarded_tasks WHERE id = $1",
      [id]
    );
    return rows.length > 0;
  },

  async save(entry) {
    await getDb().query(
      `INSERT INTO rewarded_tasks (id, user_id, story_points, rewarded_at)
       VALUES ($1, $2, $3, $4)`,
      [entry.id, entry.user_id, entry.story_points, entry.rewarded_at]
    );
    return entry;
  },

  async clear() {
    await getDb().query("DELETE FROM rewarded_tasks");
  },
};
