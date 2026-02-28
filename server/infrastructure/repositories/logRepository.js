// server/infrastructure/repositories/logRepository.js

import { getDb } from "../db.pg.js";

export const logRepository = {
  async save(entry) {
    const { rows } = await getDb().query(
      `INSERT INTO reward_log (user_id, message, created_at)
       VALUES ($1, $2, $3) RETURNING id`,
      [entry.user_id, entry.message, entry.created_at]
    );
    return { id: rows[0].id, ...entry };
  },

  async findLatest(limit) {
    const { rows } = await getDb().query(
      `SELECT id, user_id, message, created_at
       FROM reward_log
       WHERE user_id = 'local'
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async clear() {
    await getDb().query("DELETE FROM reward_log");
  },
};
