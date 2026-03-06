INSERT INTO users (id, level, exp, gold, updated_at)
VALUES ('u3', 1, 0, 0, '2024-01-01T00:00:00.000Z')
ON CONFLICT (id) DO NOTHING;
