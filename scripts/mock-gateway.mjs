/**
 * Dev-only mock gateway — UI work without the Docker backend.
 *
 *   node scripts/mock-gateway.mjs        # listens on 127.0.0.1:8000
 *
 * The trader app's server-side /api/v1 proxy already defaults to
 * http://127.0.0.1:8000, so no env changes are needed: `npm run dev` in
 * frontend/trader + this script = working login (real + demo) and /auth/me.
 * Everything unmocked returns 404 with the requested path logged, so missing
 * endpoints are easy to spot and add below.
 *
 * NEVER deploy this — it authenticates everyone as the demo user.
 */

import { createServer } from "node:http";

const PORT = 8000;

const user = {
  id: "u-demo-0001",
  email: "demo@fxartha.dev",
  first_name: "Demo",
  last_name: "Trader",
  phone: "+10000000000",
  country: "IN",
  address: null,
  city: null,
  state: null,
  postal_code: null,
  date_of_birth: "1990-01-01",
  role: "trader",
  status: "active",
  kyc_status: "approved",
  is_demo: true,
  two_factor_enabled: false,
  language: "en",
  theme: "dark",
  profile_complete: true,
  wallet_address: null,
  has_password: true,
  has_google: false,
  wallet_linked: true,
  email_verified: true,
  is_wallet_placeholder: false,
  created_at: "2026-01-01T00:00:00Z",
};

const token = () => ({
  access_token: "dev-mock-token",
  token_type: "bearer",
  user_id: user.id,
  role: user.role,
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
});

const routes = {
  "POST /api/v1/auth/login": () => token(),
  "POST /api/v1/auth/demo-login": () => token(),
  "POST /api/v1/auth/refresh": () => token(),
  "POST /api/v1/auth/logout": () => ({ message: "ok" }),
  "GET /api/v1/auth/me": () => user,
  // Common list endpoints the dashboard touches — empty but valid.
  "GET /api/v1/accounts": () => [],
  "GET /api/v1/notifications": () => [],
  "GET /api/v1/portfolio/trades": () => ({
    items: [
      {
        id: "t-0003",
        symbol: "EURUSD",
        side: "buy",
        lots: 0.5,
        pnl: 118.4,
        open_time: "2026-08-02T09:12:00Z",
        close_time: "2026-08-02T14:40:00Z",
        duration: "5h 28m",
        entry_price: 1.0794,
        exit_price: 1.0817,
        close_reason: "take_profit",
      },
      {
        id: "t-0002",
        symbol: "XAUUSD",
        side: "sell",
        lots: 0.1,
        pnl: -32.6,
        open_time: "2026-08-01T11:05:00Z",
        close_time: "2026-08-01T16:22:00Z",
        duration: "5h 17m",
        entry_price: 2412.4,
        exit_price: 2415.7,
        close_reason: "stop_loss",
      },
      {
        id: "t-0001",
        symbol: "GBPUSD",
        side: "buy",
        lots: 0.3,
        pnl: 144.7,
        open_time: "2026-07-31T08:30:00Z",
        close_time: "2026-07-31T13:02:00Z",
        duration: "4h 32m",
        entry_price: 1.2712,
        exit_price: 1.276,
        close_reason: "manual",
      },
    ],
  }),
  "GET /api/v1/portfolio/summary": () => ({
    total_balance: 10000,
    total_equity: 10230.5,
    total_unrealized_pnl: 230.5,
    pnl_breakdown: {
      today: 42.1,
      this_week: 118.4,
      this_month: 230.5,
      all_time: 230.5,
    },
    holdings: [],
  }),
};

createServer((req, res) => {
  const path = req.url.split("?")[0];
  const key = `${req.method} ${path}`;
  const handler = routes[key];

  // Drain the body so keep-alive connections stay clean.
  req.resume();
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (handler) {
      if (path.includes("/auth/login") || path.includes("/auth/demo-login")) {
        res.setHeader(
          "set-cookie",
          "access_token=dev-mock-token; Path=/; SameSite=Lax",
        );
      }
      res.writeHead(200);
      res.end(JSON.stringify(handler()));
      console.log(`✓ ${key}`);
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ detail: `mock-gateway: ${key} not mocked` }));
      console.log(`✗ ${key} (404 — add it to scripts/mock-gateway.mjs)`);
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock-gateway listening on http://127.0.0.1:${PORT}`);
});
