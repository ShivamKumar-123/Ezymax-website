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

  "GET /api/v1/portfolio/performance": () => {
    // 30-day equity curve drifting 10,000 → 10,230.50 with gentle noise.
    const days = 30;
    const points = [];
    for (let i = 0; i < days; i++) {
      const t = i / (days - 1);
      const wobble = Math.sin(i * 1.7) * 28 + Math.sin(i * 0.6) * 40;
      points.push({
        time: new Date(Date.now() - (days - 1 - i) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        equity: Math.round((10_000 + t * 230.5 + wobble * t) * 100) / 100,
      });
    }
    return { equity_curve: points };
  },

  "GET /api/v1/banners": () => ({ banners: [] }),

  "GET /api/v1/instruments/prices/all": () =>
    Object.entries(BASE_PRICES).map(([symbol, base]) => {
      const drift = 1 + (Math.sin(Date.now() / 60_000 + base) * 0.002);
      const mid = base * drift;
      const spread = base * 0.0002;
      return {
        symbol,
        bid: round5(mid - spread / 2),
        ask: round5(mid + spread / 2),
      };
    }),

  /* profile / onboarding */
  "POST /api/v1/profile/onboarding/complete": () => ({ message: "ok" }),
  "POST /api/v1/profile/onboarding/reset": () => ({ message: "ok" }),

  /* staking — demo plans; open/withdraw positions stateful-lite */
  "GET /api/v1/staking/plans": () => [
    { id: "sp-flex", slug: "flexible", label: "Flexible", description: "Withdraw any time. Earns while you wait for setups.", mode: "flexible", lock_months: null, apy_bps: 300, apy_pct: 3, min_amount: 100, trading_bonus_multiplier_bps: 0, trading_bonus_pct: 0 },
    { id: "sp-3m", slug: "locked-3m", label: "3-Month Lock", description: "Higher rate for a short commitment.", mode: "locked", lock_months: 3, apy_bps: 600, apy_pct: 6, min_amount: 250, trading_bonus_multiplier_bps: 500, trading_bonus_pct: 5 },
    { id: "sp-6m", slug: "locked-6m", label: "6-Month Lock", description: "Best balance of rate and flexibility.", mode: "locked", lock_months: 6, apy_bps: 900, apy_pct: 9, min_amount: 500, trading_bonus_multiplier_bps: 1000, trading_bonus_pct: 10 },
    { id: "sp-12m", slug: "locked-12m", label: "12-Month Lock", description: "Top rate plus the biggest trading bonus.", mode: "locked", lock_months: 12, apy_bps: 1400, apy_pct: 14, min_amount: 1000, trading_bonus_multiplier_bps: 2000, trading_bonus_pct: 20 },
  ],
  "GET /api/v1/staking/positions": () => [],
  "GET /api/v1/staking/referral-summary": () => ({}),

  /* correct-shaped empties so list pages render their empty states instead
     of crashing on the generic {} fallback */
  "GET /api/v1/wallet/transactions": () => ({ items: [] }),
  "GET /api/v1/wallet/deposits": () => ({ items: [] }),
  "GET /api/v1/wallet/withdrawals": () => ({ items: [] }),
  "GET /api/v1/followers/my-followers": () => ({ items: [], total: 0 }),
  "GET /api/v1/social/my-provider": () => ({}),
  "GET /api/v1/social/my-copies": () => ({ items: [], total: 0 }),
  "GET /api/v1/social/master-performance": () => ({}),
  "GET /api/v1/social/master-investors": () => ({ investors: [] }),
  "GET /api/v1/social/mamm-pamm": () => ({ items: [] }),
  "GET /api/v1/social/my-allocations": () => ({ items: [], summary: {} }),
  "GET /api/v1/social/leaderboard": () => ({ items: [] }),
  "GET /api/v1/social/master-investors/eligibility": () => ({}),
  "GET /api/v1/insurance/active": () => [],
  "GET /api/v1/insurance/policies": () => [],
  "GET /api/v1/insurance/claims": () => [],
  "GET /api/v1/rewards/store": () => [
    { id: "st-1", slug: "spread-rebate-10", category: "cashback", label: "$10 Spread Rebate", description: "Credited against your next trades' spread costs.", ac_price: 120 },
    { id: "st-2", slug: "insurance-voucher", category: "bonus", label: "Insurance Voucher", description: "One free Standard-tier trade insurance activation.", ac_price: 90 },
    { id: "st-3", slug: "priority-support", category: "perk", label: "Priority Support (1 mo)", description: "Skip the queue with the priority desk.", ac_price: 150 },
    { id: "st-4", slug: "ai-analysis", category: "tool", label: "AI Trade Analysis (10)", description: "Ten AI-generated reviews of your closed trades.", ac_price: 200 },
    { id: "st-5", slug: "tradingview-1mo", category: "tool", label: "TradingView Pro (1 mo)", description: "One month of TradingView Pro on us.", ac_price: 320 },
    { id: "st-6", slug: "event-ticket", category: "lifestyle", label: "Trading Summit Ticket", description: "Entry to the next FXArtha community summit.", ac_price: 500, min_ps: 700 },
  ],
  "GET /api/v1/rewards/missions": () => [],
  "GET /api/v1/rewards/leaderboard": () => [],
  "GET /api/v1/play/spin/recent": () => [],
  "GET /api/v1/play/spin/prizes": () => ({
    cost_ac: 50,
    prizes: [
      { id: "pz-1", slug: "xp-100", label: "100 XP", weight: 30, probability: 0.3, payout_kind: "xp", payout_amount: 100, display_order: 1 },
      { id: "pz-2", slug: "ac-25", label: "25 Credits", weight: 22, probability: 0.22, payout_kind: "ac", payout_amount: 25, display_order: 2 },
      { id: "pz-3", slug: "nothing-1", label: "Spin again", weight: 18, probability: 0.18, payout_kind: "nothing", payout_amount: 0, display_order: 3 },
      { id: "pz-4", slug: "xp-250", label: "250 XP", weight: 12, probability: 0.12, payout_kind: "xp", payout_amount: 250, display_order: 4 },
      { id: "pz-5", slug: "cashback-5", label: "$5 Cashback", weight: 8, probability: 0.08, payout_kind: "cashback", payout_amount: 5, display_order: 5 },
      { id: "pz-6", slug: "ac-100", label: "100 Credits", weight: 6, probability: 0.06, payout_kind: "ac", payout_amount: 100, display_order: 6 },
      { id: "pz-7", slug: "nothing-2", label: "Better luck", weight: 3, probability: 0.03, payout_kind: "nothing", payout_amount: 0, display_order: 7 },
      { id: "pz-8", slug: "cashback-25", label: "$25 Cashback", weight: 1, probability: 0.01, payout_kind: "cashback", payout_amount: 25, display_order: 8 },
    ],
  }),
};

/* ── synthetic market data ── */
const BASE_PRICES = {
  EURUSD: 1.08,
  GBPUSD: 1.2712,
  XAUUSD: 2412.4,
  NAS100: 20150,
  BTCUSD: 64200,
  ETHUSD: 3150,
};
const round5 = (n) => Math.round(n * 100000) / 100000;

/** Daily bars per symbol — deterministic sin-walk, 30 days. */
const barsFor = (symbol) => {
  const base = BASE_PRICES[symbol] ?? 100;
  const bars = [];
  for (let i = 0; i < 30; i++) {
    const w = Math.sin(i * 0.9 + base) * 0.012 + Math.sin(i * 0.31) * 0.006;
    const open = round5(base * (1 + w));
    const close = round5(base * (1 + w + Math.sin(i * 2.3) * 0.004));
    bars.push({
      time: Math.floor((Date.now() - (29 - i) * 86_400_000) / 1000),
      open,
      close,
    });
  }
  return bars;
};

/* ── dynamic routes (path params) ── */
const dynamicRoutes = [
  {
    test: /^GET \/api\/v1\/instruments\/([A-Za-z0-9]+)\/bars$/,
    handler: (match) => barsFor(match[1].toUpperCase()),
  },
];

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
      // Dynamic routes (path params), then smart fallbacks so unmocked
      // endpoints never surface "not mocked" errors in the UI:
      //   unknown GET  → 200 {}   (callers all have `|| []` style fallbacks)
      //   unknown write → 400 with a clean demo message
      const dyn = dynamicRoutes.find((d) => d.test.test(key));
      if (dyn) {
        const out = dyn.handler(key.match(dyn.test), body);
        res.writeHead(200);
        res.end(JSON.stringify(out));
        console.log(`✓ ${key} (dynamic)`);
      } else if (req.method === "GET") {
        // `items: []` satisfies both list pages ({items}) and pages that
        // just read optional fields off an object.
        res.writeHead(200);
        res.end(JSON.stringify({ items: [] }));
        console.log(`○ ${key} (empty fallback — mock properly if a screen needs data)`);
      } else {
        res.writeHead(400);
        res.end(
          JSON.stringify({ detail: "Not available in the demo yet." }),
        );
        console.log(`○ ${key} (demo-blocked fallback)`);
      }
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock-gateway listening on http://127.0.0.1:${PORT}`);
});
