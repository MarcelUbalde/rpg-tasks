// server/infrastructure/repositories/rewardRepository.js

import { db } from "../db.js";

const existsStmt = db.prepare(
  "SELECT id FROM rewarded_tasks WHERE id = ?"
);

const saveStmt = db.prepare(
  `INSERT INTO rewarded_tasks (id, user_id, story_points, rewarded_at)
   VALUES (@id, @user_id, @story_points, @rewarded_at)`
);

const clearStmt = db.prepare("DELETE FROM rewarded_tasks");

export const rewardRepository = {
  existsById(id) {
    return existsStmt.get(id) !== undefined;
  },
  save(entry) {
    saveStmt.run(entry);
    return entry;
  },
  clear() {
    clearStmt.run();
  },
};
