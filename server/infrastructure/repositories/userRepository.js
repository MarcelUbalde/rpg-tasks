// server/infrastructure/repositories/userRepository.js
// Prepared statements are compiled once at module load for efficiency.

import { db } from "../db.js";

const findStmt = db.prepare(
  "SELECT id, level, exp, gold, updated_at FROM users WHERE id = ?"
);

const saveStmt = db.prepare(
  `INSERT INTO users (id, level, exp, gold, updated_at)
   VALUES (@id, @level, @exp, @gold, @updated_at)
   ON CONFLICT(id) DO UPDATE SET
     level = @level, exp = @exp, gold = @gold, updated_at = @updated_at`
);

const resetStmt = db.prepare(
  "UPDATE users SET level = 1, exp = 0, gold = 0, updated_at = ? WHERE id = ?"
);

export const userRepository = {
  findById(id) {
    return findStmt.get(id);
  },
  save(user) {
    saveStmt.run(user);
    return user;
  },
  reset(id) {
    resetStmt.run(new Date().toISOString(), id);
  },
};
