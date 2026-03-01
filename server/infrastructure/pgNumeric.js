// server/infrastructure/pgNumeric.js
// Strict coercion for PostgreSQL NUMERIC/DECIMAL columns.
// The pg driver returns NUMERIC as strings by default to preserve arbitrary precision.
// This helper converts them to JS numbers and throws on any unexpected value
// so corruption is never silent.

export function coerceNumeric(v) {
  if (v == null) {
    throw new Error(`coerceNumeric: got ${JSON.stringify(v)}, expected a numeric value`);
  }
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`coerceNumeric: got ${JSON.stringify(v)}, expected a finite number`);
  }
  return n;
}
