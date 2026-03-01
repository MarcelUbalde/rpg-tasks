// server/infrastructure/repositories/userRepository.pg.factory.js
// Async Postgres user repo factory. getDb() is called at query time so that
// calls inside runInTransaction() automatically use the transaction client.

import { getDb } from "../db.pg.js";
import { coerceNumeric } from "../pgNumeric.js";

// Coerce users.exp from NUMERIC string to JS number.
// pg returns NUMERIC(12,2) columns as strings by default.
export function mapUser(row) {
  if (!row) return null;
  return { ...row, exp: coerceNumeric(row.exp) };
}

export function makeUserRepositoryPg() {
  return {
    async findById(id) {
      const { rows } = await getDb().query(
        "SELECT id, level, exp, gold, updated_at FROM users WHERE id = $1",
        [id]
      );
      return mapUser(rows[0] ?? null);
    },

    async findAll() {
      const { rows } = await getDb().query(
        "SELECT id, level, exp, gold, updated_at FROM users ORDER BY id"
      );
      return rows.map(mapUser);
    },

    async save(u) {
      await getDb().query(
        `INSERT INTO users (id, level, exp, gold, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           level      = EXCLUDED.level,
           exp        = EXCLUDED.exp,
           gold       = EXCLUDED.gold,
           updated_at = EXCLUDED.updated_at`,
        [u.id, u.level, Number(u.exp), u.gold, u.updated_at]
      );
      return u;
    },

    async reset(id) {
      await getDb().query(
        "UPDATE users SET level = 1, exp = 0, gold = 0, updated_at = $1 WHERE id = $2",
        [new Date().toISOString(), id]
      );
    },
  };
}
