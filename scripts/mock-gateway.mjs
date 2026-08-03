/**
 * Dev-only mock gateway — UI work without the Docker backend.
 *
 *   node scripts/mock-gateway.mjs        # listens on 127.0.0.1:8000
 *
 * The trader app's server-side /api/v1 proxy already defaults to
 * http://127.0.0.1:8000, so no env changes are needed. Stateful demo:
 * accounts can be OPENED (demo only) and wallet↔account transfers move real
 * numbers; deposits/withdrawals return a "demo mode" error on purpose.
 * Everything unmocked returns 404 with the path logged.
 *
 * NEVER deploy this — it authenticates everyone as the demo user.
 */

import { createServer } from "node:http";

const PORT = 8000;

/* ── demo user ── */
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
  tour_completed: true,
  onboarding_complete: true,
  created_at: "2026-01-01T00:00:00Z",
};

const token = () => ({
  access_token: "dev-mock-token",
  token_type: "bearer",
  user_id: user.id,
  role: user.role,
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
});

/* ── stateful demo wallet + accounts ── */
let mainWallet = 10_000;
let accSeq = 1;

const makeAccount = (leverage, balance) => ({
  id: `acc-${accSeq}`,
  account_number: `DEMO-1000${accSeq}`,
  balance,
  credit: 0,
  equity: balance,
  margin_used: 0,
  free_margin: balance,
  margin_level: 0,
  leverage,
  currency: "USD",
  is_demo: true,
  is_active: true,
});

const accounts = [makeAccount(100, 5_000)];

const findAccount = (id) => accounts.find((a) => a.id === id);

const err = (status, detail) => ({ __status: status, detail });

const DEMO_BLOCKED =
  "Demo mode — deposits and withdrawals are disabled. Trade with the demo balance instead.";

/* ── routes: (body) => object; add __status for non-200 ── */
const routes = {
  "POST /api/v1/auth/login": () => token(),
  "POST /api/v1/auth/demo-login": () => token(),
  "POST /api/v1/auth/refresh": () => token(),
  "POST /api/v1/auth/logout": () => ({ message: "ok" }),
  "GET /api/v1/auth/me": () => user,
  /* SIWE wallet sign-in — permissive: any address/signature authenticates
     the demo user (dev only; the real gateway verifies the signature). */
  "POST /api/v1/auth/wallet/nonce": (body) => ({
    nonce: Math.random().toString(16).slice(2, 18),
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    domain: "localhost:3001",
    statement: `Sign in to FXArtha (demo) as ${body?.address ?? "0x…"}`,
  }),
  "POST /api/v1/auth/wallet/verify": () => token(),
  "GET /api/v1/auth/platform-status": () => ({
    maintenance_mode: false,
    allow_new_registrations: true,
    allow_deposits: true,
    allow_withdrawals: true,
  }),

  "GET /api/v1/notifications": () => [],
  "GET /api/v1/notifications/unread-count": () => ({ count: 0 }),

  "GET /api/v1/rewards/state": () => ({
    xp: 1250,
    level: 3,
    ac_balance: 240,
    ps: 610,
    streak_count: 4,
    streak_checked_in_today: false,
  }),

  /* accounts — open works, demo only */
  "GET /api/v1/accounts": () => accounts,
  "GET /api/v1/accounts/available-groups": () => ({
    items: [
      {
        id: "g-demo-standard",
        name: "Demo Standard",
        description: "Practice account funded with demo money.",
        leverage_default: 100,
        max_leverage: 200,
        effective_max_leverage: 200,
      },
      {
        id: "g-demo-pro",
        name: "Demo Pro",
        description: "Tighter spreads and higher leverage — demo money.",
        leverage_default: 200,
        max_leverage: 500,
        effective_max_leverage: 500,
      },
    ],
  }),
  "POST /api/v1/accounts/open": (body) => {
    accSeq += 1;
    const account = makeAccount(Number(body?.leverage) || 100, 10_000);
    accounts.push(account);
    return { id: account.id, account_number: account.account_number };
  },

  /* wallet — summary + transfers work; deposit/withdraw demo-blocked */
  "GET /api/v1/wallet/summary": () => ({
    main_wallet_balance: mainWallet,
    balance: mainWallet,
  }),
  "POST /api/v1/wallet/transfer-main-to-trading": (body) => {
    const amount = Number(body?.amount) || 0;
    const account = findAccount(body?.to_account_id);
    if (!account) return err(404, "Account not found");
    if (amount <= 0 || amount > mainWallet)
      return err(400, "Insufficient main wallet balance");
    mainWallet -= amount;
    account.balance += amount;
    account.equity += amount;
    account.free_margin += amount;
    return { message: "ok", main_wallet_balance: mainWallet };
  },
  "POST /api/v1/wallet/transfer-trading-to-main": (body) => {
    const amount = Number(body?.amount) || 0;
    const account = findAccount(body?.from_account_id);
    if (!account) return err(404, "Account not found");
    if (amount <= 0 || amount > account.free_margin)
      return err(400, "Insufficient free margin");
    account.balance -= amount;
    account.equity -= amount;
    account.free_margin -= amount;
    mainWallet += amount;
    return { message: "ok", main_wallet_balance: mainWallet };
  },
  "POST /api/v1/wallet/transfer-internal": (body) => {
    const amount = Number(body?.amount) || 0;
    const from = findAccount(body?.from_account_id);
    const to = findAccount(body?.to_account_id);
    if (!from || !to) return err(404, "Account not found");
    if (amount <= 0 || amount > from.free_margin)
      return err(400, "Insufficient free margin");
    from.balance -= amount;
    from.equity -= amount;
    from.free_margin -= amount;
    to.balance += amount;
    to.equity += amount;
    to.free_margin += amount;
    return { message: "ok" };
  },
  "POST /api/v1/wallet/withdraw/onchain": () => err(400, DEMO_BLOCKED),
  "POST /api/v1/wallet/deposit": () => err(400, DEMO_BLOCKED),
  "GET /api/v1/wallet/deposit-address": () => err(400, DEMO_BLOCKED),

  /* portfolio */
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

  /* profile / onboarding */
  "POST /api/v1/profile/onboarding/complete": () => ({ message: "ok" }),
  "POST /api/v1/profile/onboarding/reset": () => ({ message: "ok" }),
};

createServer((req, res) => {
  const path = req.url.split("?")[0];
  const key = `${req.method} ${path}`;
  const handler = routes[key];

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    let body;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    } catch {
      body = undefined;
    }

    res.setHeader("content-type", "application/json");
    if (handler) {
      const out = handler(body) ?? {};
      const status = Array.isArray(out) ? 200 : (out.__status ?? 200);
      let payload = out;
      if (!Array.isArray(out)) {
        payload = { ...out };
        delete payload.__status;
      }
      if (
        path.includes("/auth/login") ||
        path.includes("/auth/demo-login") ||
        path.includes("/auth/wallet/verify")
      ) {
        res.setHeader(
          "set-cookie",
          "access_token=dev-mock-token; Path=/; SameSite=Lax",
        );
      }
      res.writeHead(status);
      res.end(JSON.stringify(payload));
      console.log(`${status === 200 ? "✓" : "▲"} ${key} → ${status}`);
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ detail: `mock-gateway: ${key} not mocked` }));
      console.log(`✗ ${key} (404 — add it to scripts/mock-gateway.mjs)`);
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock-gateway listening on http://127.0.0.1:${PORT}`);
});
