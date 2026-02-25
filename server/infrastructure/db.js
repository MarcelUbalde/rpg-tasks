// server/infrastructure/db.js
// Opens SQLite, runs schema migrations, seeds the single "local" user.
// Uses node:sqlite — built into Node.js 22+ (no native compilation required).

import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("rpg-tasks.sqlite");

// WAL mode improves write performance and allows concurrent reads.
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    level      INTEGER NOT NULL DEFAULT 1,
    exp        INTEGER NOT NULL DEFAULT 0,
    gold       INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rewarded_tasks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    story_points INTEGER NOT NULL,
    rewarded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reward_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reward_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    type         TEXT NOT NULL,
    external_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    UNIQUE(type, external_key)
  );

  CREATE TABLE IF NOT EXISTS reward_event_users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER NOT NULL,
    user_id      TEXT NOT NULL,
    exp_awarded  INTEGER NOT NULL DEFAULT 0,
    gold_awarded INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    UNIQUE(event_id, user_id)
  );
`);

const seedCheck = db.prepare("SELECT id FROM users WHERE id = ?");
if (!seedCheck.get("local")) {
  db.prepare(
    "INSERT INTO users (id, level, exp, gold, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run("local", 1, 0, 0, new Date().toISOString());
}
for (const uid of ["u1", "u2"]) {
  if (!seedCheck.get(uid)) {
    db.prepare(
      "INSERT INTO users (id, level, exp, gold, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run(uid, 1, 0, 0, new Date().toISOString());
  }
}

export { db };

export function runInTransaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
