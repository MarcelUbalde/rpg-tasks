// server/infrastructure/repositories/rewardEventRepository.pg.factory.js
// Async Postgres reward event repo. assertSameOrCreate is atomic via a single CTE
// — no TOCTOU window across multiple server replicas.

import { getDb } from "../db.pg.js";

// Key-order-independent payload comparison (identical logic to SQLite factory).
function parseAndCompare(expected, storedPayloadJson) {
  const sort = (obj) => JSON.stringify(Object.fromEntries(Object.entries(obj).sort()));
  try {
    const stored = JSON.parse(storedPayloadJson);
    return { matches: sort(expected) === sort(stored), stored };
  } catch {
    return { matches: false, stored: null };
  }
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    external_key: row.external_key,
    payload_json: row.payload_json,
    created_at: row.created_at,
    issue_key: row.issue_key ?? null,
    summary: row.summary ?? null,
    story_points: row.story_points ?? null,
    severity: row.severity ?? null,
  };
}

const META_COLS = "id, type, external_key, payload_json, created_at, issue_key, summary, story_points, severity";

export function makeRewardEventRepositoryPg() {
  return {
    // Two-statement non-atomic create. Acceptable for the create-event endpoints
    // where racing creates with the same payload are idempotent.
    async findOrCreateEvent({ type, externalKey, payload, meta }) {
      const db = getDb();
      const issueKey = meta?.issueKey ?? null;
      const summary  = meta?.summary  ?? null;
      const storyPts = meta?.storyPoints ?? payload?.storyPoints ?? null;
      const sev      = meta?.severity   ?? payload?.severity    ?? null;
      await db.query(
        `INSERT INTO reward_events (type, external_key, payload_json, created_at, issue_key, summary, story_points, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (type, external_key) DO NOTHING`,
        [type, externalKey, JSON.stringify(payload), new Date().toISOString(),
         issueKey, summary, storyPts, sev]
      );
      const { rows } = await db.query(
        `SELECT ${META_COLS} FROM reward_events WHERE type = $1 AND external_key = $2`,
        [type, externalKey]
      );
      return mapRow(rows[0]);
    },

    // ATOMIC via CTE: single round-trip, no TOCTOU window under concurrent replicas.
    // ON CONFLICT DO NOTHING → ins RETURNING is empty for an existing row.
    // UNION ALL branch reads the existing row only when ins is empty.
    // Result is always exactly 1 row.
    async assertSameOrCreate({ type, externalKey, payload, meta }) {
      const db = getDb();
      const issueKey = meta?.issueKey ?? null;
      const summary  = meta?.summary  ?? null;
      const storyPts = meta?.storyPoints ?? payload?.storyPoints ?? null;
      const sev      = meta?.severity   ?? payload?.severity    ?? null;

      const { rows } = await db.query(
        `WITH ins AS (
           INSERT INTO reward_events (type, external_key, payload_json, created_at, issue_key, summary, story_points, severity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (type, external_key) DO NOTHING
           RETURNING ${META_COLS}
         )
         SELECT ${META_COLS} FROM ins
         UNION ALL
         SELECT ${META_COLS}
           FROM reward_events
          WHERE type = $1 AND external_key = $2
            AND NOT EXISTS (SELECT 1 FROM ins)`,
        [type, externalKey, JSON.stringify(payload), new Date().toISOString(),
         issueKey, summary, storyPts, sev]
      );

      const row = rows[0];
      if (!row) {
        // Cannot happen in Postgres (CTE guarantees a row) — kept for API parity.
        const e = new Error(
          `invariant violated: reward event not found after insert (type=${type}, key=${externalKey})`
        );
        e.code = "invariant_violation";
        e.type = type;
        e.externalKey = externalKey;
        throw e;
      }

      const { matches, stored } = parseAndCompare(payload, row.payload_json);
      if (!matches) {
        const err = new Error("payload_mismatch");
        err.code = "payload_mismatch";
        err.type = type;
        err.externalKey = externalKey;
        err.storedPayload = stored;
        err.requestedPayload = payload;
        throw err;
      }
      return mapRow(row);
    },

    async findByTypeAndKey(type, externalKey) {
      const db = getDb();
      const { rows } = await db.query(
        `SELECT ${META_COLS} FROM reward_events WHERE type = $1 AND external_key = $2`,
        [type, externalKey]
      );
      return mapRow(rows[0] ?? null);
    },

    async findById(eventId) {
      const db = getDb();
      const { rows } = await db.query(
        `SELECT ${META_COLS} FROM reward_events WHERE id = $1`,
        [eventId]
      );
      return mapRow(rows[0] ?? null);
    },
  };
}
