// server/index.js
// Entry point — wires Express, static files, and API routes.

import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Side-effect import: runs migrations and seeds the "local" user on startup.
import "./infrastructure/db.js";

import { userRouter } from "./routes/user.js";
import { tasksRouter } from "./routes/tasks.js";
import { logRouter } from "./routes/log.js";
import { devRouter } from "./routes/dev.js";

// __dirname is not available in ES modules — reconstruct from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, "../public")));

app.use("/api/user", userRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/log", logRouter);

if (process.env.NODE_ENV !== "production") {
  app.use("/api/dev", devRouter);
}

// Global error handler (4-param signature required by Express)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  console.log(`RPG Tasks → http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nError: el puerto ${PORT} ya está en uso.\n` +
      `Cierra el proceso anterior o usa: PORT=3001 npm start\n`
    );
    process.exit(1);
  }
  throw err;
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
