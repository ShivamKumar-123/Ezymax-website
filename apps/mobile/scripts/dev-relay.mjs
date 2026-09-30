// Mobile dev relay: one LAN-reachable port that maps the local stack the way the production edge (Caddy) does,
// so a phone running Expo Go can use the local services with a single EXPO_PUBLIC_API_BASE.
//
//   /api/*          -> Client Area BFF      127.0.0.1:3000   (the /api/mobile/* routes)
//   /s/*, /r/*      -> Client Area          127.0.0.1:3000   (share cards, referral links the app shows)
//   /v1/*  (+ WS)   -> market-data          127.0.0.1:8081   (quotes, candles, /v1/stream)
//   /engine/stream  -> trading engine WS    127.0.0.1:8090   /v1/terminal/stream
//   /support/stream -> support WS           127.0.0.1:8100   /v1/stream
//   anything else   -> the web export in dist-web/ (react-native-web preview), when it exists
//
//   pnpm --filter @kalks/mobile dev-relay            # listens on 0.0.0.0:8790
//   EXPO_PUBLIC_API_BASE=http://<Mac LAN IP>:8790 pnpm --filter @kalks/mobile start
//
// Development only: never deploy this. It adds no authentication of its own; the services behind it check
// sessions and one-time tickets exactly as in production.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request } from "node:http";
import { connect } from "node:net";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.RELAY_PORT ?? 8790);
const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, "..", process.env.RELAY_WEB_DIR ?? "dist-web");

function target(path) {
  if (path.startsWith("/api/")) return { port: 3000, path };
  // the Client Area's public pages the app links to: share cards (/s/<code>, /s/<code>/image) and referral links
  if (path.startsWith("/s/") || path.startsWith("/r/")) return { port: 3000, path };
  if (path.startsWith("/v1/")) return { port: 8081, path };
  if (path.startsWith("/engine/stream")) return { port: 8090, path: path.replace("/engine/stream", "/v1/terminal/stream") };
  if (path.startsWith("/support/stream")) return { port: 8100, path: path.replace("/support/stream", "/v1/stream") };
  return null;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".ttf": "font/ttf", ".wasm": "application/wasm", ".ico": "image/x-icon", ".svg": "image/svg+xml" };

function serveStatic(req, res) {
  const url = new URL(req.url, "http://relay");
  let file = normalize(join(WEB, decodeURIComponent(url.pathname)));
  if (!file.startsWith(WEB)) return res.writeHead(403).end();
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(WEB, "index.html");
  if (!existsSync(file)) return res.writeHead(404, { "content-type": "text/plain" }).end("No web export (run: pnpm --filter @kalks/mobile export:web)");
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const t = target(req.url ?? "/");
  if (!t) return serveStatic(req, res);
  const headers = { ...req.headers, "x-forwarded-host": req.headers.host ?? "", "x-forwarded-proto": "http" };
  const up = request({ host: "127.0.0.1", port: t.port, method: req.method, path: t.path, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on("error", () => res.headersSent || res.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({ error: { code: "unavailable", message: "Local service is down." } })));
  req.pipe(up);
});

server.on("upgrade", (req, socket, head) => {
  const t = target(req.url ?? "/");
  if (!t) return socket.destroy();
  const up = connect(t.port, "127.0.0.1", () => {
    const lines = [`${req.method} ${t.path} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join("\r\n") + "\r\n\r\n");
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  const close = () => {
    up.destroy();
    socket.destroy();
  };
  up.on("error", close);
  socket.on("error", close);
});

server.listen(PORT, "0.0.0.0", () => console.log(`Kalks mobile dev relay on http://0.0.0.0:${PORT}`));
