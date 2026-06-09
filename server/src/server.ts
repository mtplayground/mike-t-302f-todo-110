import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, env.HOST, () => {
  console.info(`Server listening on http://${env.HOST}:${env.PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.info(`Received ${signal}; shutting down HTTP server`);
  server.close((error?: Error) => {
    if (error) {
      console.error("HTTP server shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
