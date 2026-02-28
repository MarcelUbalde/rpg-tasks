// server/infrastructure/db.pg.js
// Postgres connection pool + AsyncLocalStorage-based transaction propagation.
//
// Pattern: getDb() returns the current transaction client if called inside
// runInTransaction(), otherwise returns the pool. All pg repo methods call
// getDb() at query time (not factory creation time) so they automatically
// participate in any active transaction.
//
// Pool is created lazily on first call to getPool() — not at import time.
// This eliminates any dependency on dotenv load order.

import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";

let _pool = null;

function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error(
      "DATABASE_URL is not set. Ensure .env is loaded before any DB call.\n" +
      "  Hint: create .env from .env.example and verify import \"dotenv/config\" " +
      "is the first import in server/index.js."
    );
    _pool = new pg.Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    _pool.on("error", (err) => console.error("PG pool error:", err));
  }
  return _pool;
}

// Ambient transaction store: { client: PoolClient } | undefined
const txStorage = new AsyncLocalStorage();

/**
 * Returns the current transaction client if inside runInTransaction,
 * otherwise returns the pool (which auto-acquires/releases per query).
 * ALL PG repo methods must call getDb() at query time, not factory creation time.
 */
export function getDb() {
  const store = txStorage.getStore();
  return store ? store.client : getPool();
}

/**
 * Wraps fn in BEGIN/COMMIT/ROLLBACK. Any repo method called (directly or
 * indirectly) from fn that calls getDb() will use the same client.
 * Compatible drop-in for the SQLite runInTransaction signature.
 */
export async function runInTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let result;
    await new Promise((resolve, reject) => {
      txStorage.run({ client }, async () => {
        try { result = await fn(); resolve(); }
        catch (err) { reject(err); }
      });
    });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Call on SIGINT/SIGTERM to drain the pool gracefully. */
export async function closePgPool() {
  if (_pool) { await _pool.end(); _pool = null; }
}
