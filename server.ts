/**
 * Custom Next.js server with WebSocket support.
 *
 * Wraps the Next.js request handler and adds a WebSocketServer at /ws.
 * Exchange WebSocket connections are made server-side, bypassing country-level
 * blocks on exchange endpoints.
 *
 * Usage:
 *   Dev:        tsx server.ts
 *   Production: node dist/server.js  (after tsc --project tsconfig.server.json)
 */

import { createServer } from "http";
import next from "next";
import { WebSocketServer } from "ws";
import { ExchangeHub } from "./lib/server/exchange-hub";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
// Use HOST env var if set, otherwise default to localhost for dev and 0.0.0.0 for production
const hostname = process.env.HOST ?? (dev ? "localhost" : "0.0.0.0");

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const hub = new ExchangeHub();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
    // All other upgrade requests (e.g. Next.js HMR) fall through untouched
  });

  // Send WebSocket-level pings every 30s to keep cloud proxies from closing idle connections
  setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.readyState === ws.OPEN) ws.ping();
    }
  }, 30_000);

  wss.on("connection", (ws) => {
    hub.addClient(ws);
  });

  server.listen(port, hostname, () => {
    process.stdout.write(
      `> Ready on http://${hostname}:${port} (${dev ? "dev" : "production"})\n`,
    );
  });

  // Graceful shutdown
  function shutdown() {
    hub.shutdown();
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
