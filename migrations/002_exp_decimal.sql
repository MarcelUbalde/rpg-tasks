BEGIN;
ALTER TABLE users ALTER COLUMN exp TYPE NUMERIC(12,2) USING exp::numeric;
ALTER TABLE reward_event_users ALTER COLUMN exp_awarded TYPE NUMERIC(12,2) USING exp_awarded::numeric;
COMMIT;
