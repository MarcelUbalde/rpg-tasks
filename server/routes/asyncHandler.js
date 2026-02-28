// server/routes/asyncHandler.js
// Wraps an async route handler so any rejected promise is forwarded to
// Express's error middleware via next(err) instead of becoming an unhandled rejection.
// Required in Express 4 — Express 5 handles this automatically.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
