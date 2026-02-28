BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id         TEXT    PRIMARY KEY,
  level      INTEGER NOT NULL DEFAULT 1,
  exp        INTEGER NOT NULL DEFAULT 0,
  gold       INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS rewarded_tasks (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL,
  story_points INTEGER NOT NULL,
  rewarded_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT      NOT NULL,
  message    TEXT      NOT NULL,
  created_at TEXT      NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_events (
  id           BIGSERIAL PRIMARY KEY,
  type         TEXT NOT NULL,
  external_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  UNIQUE (type, external_key)
);

CREATE TABLE IF NOT EXISTS reward_event_users (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT  NOT NULL REFERENCES reward_events(id) ON DELETE CASCADE,
  user_id      TEXT    NOT NULL,
  exp_awarded  INTEGER NOT NULL DEFAULT 0,
  gold_awarded INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reu_user_created
  ON reward_event_users (user_id, created_at DESC);

-- Seed default users (idempotent)
INSERT INTO users (id, level, exp, gold, updated_at)
VALUES
  ('local', 1, 0, 0, '2024-01-01T00:00:00.000Z'),
  ('u1',    1, 0, 0, '2024-01-01T00:00:00.000Z'),
  ('u2',    1, 0, 0, '2024-01-01T00:00:00.000Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
