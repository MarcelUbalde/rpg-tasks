// Lightweight migration runner — node migrate.js
// Applies migrations/NNN_*.sql files in order; tracks applied in _migrations table.

import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env if present (optional for CI where env vars are injected directly)
try { const { config } = await import("dotenv"); config(); } catch { /* dotenv optional */ }

async function migrate() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL  PRIMARY KEY,
        filename   TEXT    NOT NULL UNIQUE,
        applied_at TEXT    NOT NULL DEFAULT to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    `);

    const dir = join(__dirname, "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE filename = $1", [file]
      );
      if (rows.length > 0) { console.log(`  skip  ${file}`); continue; }
      console.log(`  apply ${file} ...`);
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
      console.log(`  done  ${file}`);
    }
    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => { console.error("Migration failed:", err.message); process.exit(1); });
