import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import express, { type Express } from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { tasksRouter } from "./routes/tasks.js";

const defaultClientDistPath = fileURLToPath(new URL("../../client/dist", import.meta.url));

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.use("/health", healthRouter);
  app.use("/tasks", tasksRouter);

  const clientDistPath = env.CLIENT_DIST_PATH || defaultClientDistPath;

  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
