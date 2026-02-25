// server/infrastructure/repositories/userRepository.js
// Prepared statements are compiled once at module load for efficiency.

import { db } from "../db.js";
import { makeUserRepository } from "./userRepository.factory.js";

const _base = makeUserRepository(db);

const resetStmt = db.prepare(
  "UPDATE users SET level = 1, exp = 0, gold = 0, updated_at = ? WHERE id = ?"
);

export const userRepository = {
  ..._base,
  reset(id) {
    resetStmt.run(new Date().toISOString(), id);
  },
};
