// server/infrastructure/repositories/userRepository.factory.js
// No db import — safe to use in tests with any DatabaseSync instance.

export function makeUserRepository(db) {
  const findStmt = db.prepare(
    "SELECT id, level, exp, gold, updated_at FROM users WHERE id = ?"
  );
  const findAllStmt = db.prepare(
    "SELECT id, level, exp, gold, updated_at FROM users"
  );
  const saveStmt = db.prepare(
    `INSERT INTO users (id, level, exp, gold, updated_at)
     VALUES (@id, @level, @exp, @gold, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       level = @level, exp = @exp, gold = @gold, updated_at = @updated_at`
  );
  return {
    findById: (id) => findStmt.get(id) ?? null,
    findAll:  ()   => findAllStmt.all(),
    save:     (u)  => { saveStmt.run(u); return u; },
  };
}
