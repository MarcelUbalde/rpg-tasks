// server/infrastructure/repositories/rewardEventRepository.factory.js
// No db import — safe to use in tests with any DatabaseSync instance.

// Private: compares expected payload against stored JSON, key-order-independently. CC=2.
function parseAndCompare(expected, storedPayloadJson) {
  const sort = (obj) => JSON.stringify(Object.fromEntries(Object.entries(obj).sort()));
  try {
    const stored = JSON.parse(storedPayloadJson);
    return { matches: sort(expected) === sort(stored), stored };
  } catch {
    return { matches: false, stored: null };
  }
}

export function makeRewardEventRepository(db) {
  const insertIgnoreStmt = db.prepare(
    `INSERT OR IGNORE INTO reward_events (type, external_key, payload_json, created_at, issue_key, summary, story_points, severity)
     VALUES (@type, @externalKey, @payloadJson, @createdAt, @issueKey, @summary, @storyPoints, @severity)`
  );
  const findStmt = db.prepare(
    `SELECT id, type, external_key, payload_json, created_at, issue_key, summary, story_points, severity
     FROM reward_events WHERE type = @type AND external_key = @externalKey`
  );
  const findByIdStmt = db.prepare(
    `SELECT id, type, external_key, payload_json, created_at, issue_key, summary, story_points, severity
     FROM reward_events WHERE id = @id`
  );
  const upsertStmt = db.prepare(
    `INSERT INTO reward_events (type, external_key, payload_json, created_at, issue_key, summary, story_points, severity)
     VALUES (@type, @externalKey, @payloadJson, @createdAt, @issueKey, @summary, @storyPoints, @severity)
     ON CONFLICT(type, external_key) DO UPDATE SET payload_json = excluded.payload_json`
  );
  return {
    // Immutable-by-key: INSERT OR IGNORE — if (type, key) exists, returns existing row unchanged (Create event flow).
    findOrCreateEvent({ type, externalKey, payload, meta }) {
      insertIgnoreStmt.run({
        type,
        externalKey,
        payloadJson: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
        issueKey: meta?.issueKey ?? null,
        summary: meta?.summary ?? null,
        storyPoints: meta?.storyPoints ?? payload?.storyPoints ?? null,
        severity: meta?.severity ?? payload?.severity ?? null,
      });
      return findStmt.get({ type, externalKey });
    },
    findByTypeAndKey(type, externalKey) {
      return findStmt.get({ type, externalKey }) ?? null;
    },
    findById(eventId) {
      return findByIdStmt.get({ id: eventId }) ?? null;
    },
    // Strict create: create if new; return row if payload matches; throw payload_mismatch if different. CC=3.
    assertSameOrCreate({ type, externalKey, payload, meta }) {
      insertIgnoreStmt.run({
        type, externalKey,
        payloadJson: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
        issueKey: meta?.issueKey ?? null,
        summary: meta?.summary ?? null,
        storyPoints: meta?.storyPoints ?? payload?.storyPoints ?? null,
        severity: meta?.severity ?? payload?.severity ?? null,
      });
      const row = findStmt.get({ type, externalKey });
      if (!row) {
        const e = new Error(`invariant violated: reward event not found after insert (type=${type}, key=${externalKey})`);
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
      return row;
    },
    // Deprecated: no longer used in the Award flow — events are immutable after creation. Retained for reference.
    upsertEvent({ type, externalKey, payload }) {
      upsertStmt.run({
        type,
        externalKey,
        payloadJson: JSON.stringify(payload),
        createdAt: new Date().toISOString(),
        issueKey: null,
        summary: null,
        storyPoints: payload?.storyPoints ?? null,
        severity: payload?.severity ?? null,
      });
      return findStmt.get({ type, externalKey });
    },
  };
}
