// resetDb.js — dev only: truncate all tables and re-seed default users.
// Usage: node resetDb.js  (or: npm run reset-db)

import pg from "pg";

try { const { config } = await import("dotenv"); config(); } catch { /* dotenv optional */ }

async function resetDb() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Truncate in dependency order (CASCADE handles FK children automatically).
    // RESTART IDENTITY resets BIGSERIAL sequences.
    await client.query(`
      TRUNCATE TABLE
        reward_event_users,
        reward_events,
        reward_log,
        rewarded_tasks,
        users
      RESTART IDENTITY CASCADE
    `);

    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO users (id, level, exp, gold, updated_at) VALUES
         ('local', 1, 0, 0, $1),
         ('u1',    1, 0, 0, $1),
         ('u2',    1, 0, 0, $1)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );

    console.log("DB reset: all tables truncated, users re-seeded.");
  } finally {
    client.release();
    await pool.end();
  }
}

resetDb().catch((err) => { console.error("reset-db failed:", err.message); process.exit(1); });
