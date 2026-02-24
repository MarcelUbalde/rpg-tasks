// server/infrastructure/repositories/logRepository.js

import { db } from "../db.js";

const saveStmt = db.prepare(
  `INSERT INTO reward_log (user_id, message, created_at)
   VALUES (@user_id, @message, @created_at)`
);

const latestStmt = db.prepare(
  `SELECT id, user_id, message, created_at
   FROM reward_log
   WHERE user_id = ?
   ORDER BY id DESC
   LIMIT ?`
);

const clearStmt = db.prepare("DELETE FROM reward_log");

export const logRepository = {
  save(entry) {
    const info = saveStmt.run(entry);
    return { id: Number(info.lastInsertRowid), ...entry };
  },
  findLatest(limit) {
    return latestStmt.all("local", limit);
  },
  clear() {
    clearStmt.run();
  },
};
