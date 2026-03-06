ALTER TABLE reward_events ADD COLUMN IF NOT EXISTS issue_key    TEXT;
ALTER TABLE reward_events ADD COLUMN IF NOT EXISTS summary      TEXT;
ALTER TABLE reward_events ADD COLUMN IF NOT EXISTS story_points NUMERIC(12,2);
ALTER TABLE reward_events ADD COLUMN IF NOT EXISTS severity     TEXT;
