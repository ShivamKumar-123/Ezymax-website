import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api/client';

/** Per-instrument contract size used ONLY as a fallback when the instrument
 *  feed didn't carry one. A flat 100000 (forex standard lot) is wrong for
 *  metals/crypto and made live P&L wildly off (e.g. XAUUSD 0.01 lot showed a
 *  1000× P&L vs the backend, so the running value never matched the close —
 *  client 2026-06-19). Metals = 100 oz/lot, crypto = 1 coin/lot. */
export function defaultContractSize(symbol: string): number {
  const s = (symbol || '').trim().toUpperCase();
  if (s.startsWith('XAU') || s.startsWith('XAG') || s.startsWith('XPT') || s.startsWith('XPD')) return 100;
  if (s.startsWith('BTC') || s.startsWith('ETH') || s.startsWith('XRP') || s.startsWith('LTC') || s.startsWith('SOL') || s.includes('USDT')) return 1;
  return 100000;
}

/**
 * Live floating P&L for one position, valued at the tick MID (the same
 * "user close quote" basis the backend uses). SINGLE source of truth shared by
 * the tick handler AND the positions refresh — so a refresh recomputes the
 * live number instead of slamming it to the server's `profit` (often 0/stale),
 * which was the ~1s "P&L flickers to zero" flash. Returns null when there's no
 * usable tick, so the caller keeps whatever value it already had.
 */
/** USD value of 1 unit of `quote` currency, from live prices. USD{quote}
 *  (e.g. USDJPY → JPY per USD, so USD per JPY = 1/mid) or {quote}USD
 *  (e.g. EURUSD → USD per EUR, use directly). null if no rate is available. */
function usdPerQuote(
  quote: string,
  allPrices?: Record<string, { bid: number; ask: number }> | null,
): number | null {
  if (!quote || quote === 'USD') return 1;
  if (!allPrices) return null;
  const mid = (t?: { bid: number; ask: number }) =>
    t && t.bid > 0 && t.ask > 0 ? (t.bid + t.ask) / 2 : 0;
  const usdQuote = mid(allPrices[`USD${quote}`]);   // quote per 1 USD
  if (usdQuote > 0) return 1 / usdQuote;
  const quoteUsd = mid(allPrices[`${quote}USD`]);   // USD per 1 quote
  if (quoteUsd > 0) return quoteUsd;
  return null;
}

type InstrumentLike = {
  symbol: string;
  contract_size?: number | null;
  base_currency?: string | null;
  quote_currency?: string | null;
};

/** symbol(UPPER) → instrument, cached per `instruments` array identity.
 *
 *  `livePnlFor` used to do up to two `Array.find()` scans per call, and it's
 *  called once per open position per tick — with ~500 instruments and a burst
 *  of ticks that's a linear scan storm on the render path. The store replaces
 *  the array wholesale (`setInstruments`), so a WeakMap keyed on the array
 *  identity is self-invalidating: a new array builds a new index, and the old
 *  one is collected with it. Lookup semantics are identical to the old
 *  two-pass find (exact-cased symbol wins over a case-insensitive match). */
const _instrumentIndexCache = new WeakMap<object, Map<string, InstrumentLike>>();

function instrumentIndex(instruments: InstrumentLike[] | null | undefined): Map<string, InstrumentLike> {
  if (!Array.isArray(instruments)) return new Map();
  const cached = _instrumentIndexCache.get(instruments);
  if (cached) return cached;
  const loose = new Map<string, InstrumentLike>();
  const exact = new Map<string, InstrumentLike>();
  for (const inst of instruments) {
    const raw = String(inst?.symbol ?? '');
    const key = raw.toUpperCase();
    if (!key) continue;
    if (!loose.has(key)) loose.set(key, inst);
    if (raw === key && !exact.has(key)) exact.set(key, inst);
  }
  for (const [key, inst] of exact) loose.set(key, inst);
  _instrumentIndexCache.set(instruments, loose);
  return loose;
}

export function livePnlFor(
  pos: { side: string; open_price: number; lots: number; effective_lots?: number },
  tick: { bid: number; ask: number } | undefined | null,
  instruments: Array<{ symbol: string; contract_size?: number | null; base_currency?: string | null; quote_currency?: string | null }>,
  symbol: string,
  allPrices?: Record<string, { bid: number; ask: number }> | null,
): { cp: number; pnl: number } | null {
  if (!tick) return null;
  const sym = (symbol || '').trim().toUpperCase();
  // Value P&L at the price the position will ACTUALLY close at: a BUY closes by
  // selling at the BID, a SELL closes by buying at the ASK — the same side the
  // backend books (trading_service.close_position: `c_bid if buy else c_ask`).
  // Previously this used the MID, so the displayed/estimated P&L was optimistic
  // by half the spread and never matched the booked amount — e.g. XAGUSD 0.01
  // lot estimated -$0.75 but closed -$1.10 (client 2026-07-22). Falls back to
  // the mid only if one side is missing.
  // NOTE: the earlier flicker fix (tick freshness guard in updatePrice) is
  // unrelated to this and still applies.
  const cp = pos.side === 'buy'
    ? (tick.bid > 0 ? tick.bid : (tick.bid + tick.ask) / 2)
    : (tick.ask > 0 ? tick.ask : (tick.bid + tick.ask) / 2);
  if (!(cp > 0)) return null;
  const inst = instrumentIndex(instruments).get(sym);
  const cs = inst?.contract_size || defaultContractSize(sym);
  const pnlLots = pos.effective_lots ?? pos.lots;
  let pnl = pos.side === 'buy'
    ? (cp - pos.open_price) * pnlLots * cs
    : (pos.open_price - cp) * pnlLots * cs;
  // Convert quote-currency P&L → USD (account currency).
  const base = (inst?.base_currency || (sym.length >= 6 ? sym.slice(0, 3) : '')).toUpperCase();
  const quote = (inst?.quote_currency || (sym.length >= 6 ? sym.slice(3, 6) : '')).toUpperCase();
  if (quote && quote !== 'USD' && cp) {
    if (base === 'USD') {
      // USD-base pair (USDJPY/USDCAD/USDCHF): cp = quote per USD → divide.
      pnl = pnl / cp;
    } else {
      // CROSS pair (GBPJPY, EURJPY, EURGBP…): neither side is USD. Convert the
      // quote currency to USD via a live rate — previously skipped, so a JPY
      // cross showed raw JPY as dollars, ~150× too large (client 2026-07-16).
      const r = usdPerQuote(quote, allPrices);
      if (r != null) pnl = pnl * r;
    }
  }
  return { cp, pnl };
}

// ─── Live-price freshness guard (fixes the P&L flicker WITHOUT freezing it) ───
// Two sources write prices: the live WS (/ws/prices, bursty — gaps up to ~2.5s)
// and the 1.5s REST poll (/instruments/prices/all). The poll's value is
// round-trip-stale, so applying it right after a fresher WS tick snapped the P&L
// backward for one frame — the reported profit→negative→profit flicker. Ticks
// carry a millisecond server timestamp; we ignore one whose ts is older/equal to
// the last APPLIED tick for that symbol (also drops duplicate re-publishes, which
// carry the same value). We never freeze: if nothing fresh arrived for
// STALE_TICK_GRACE_MS we let even a stale value through, so a dead WS falls back
// to the poll. Centralised here so every caller (trading layout + trade panel,
// each WS + poll) is covered. (client 2026-07-10)
/** Rebuild bid/ask symmetrically around the broadcast MID using the user's own
 *  resolved spread. Mid is preserved, so callers deriving from the mid are
 *  unaffected. Returns the tick untouched when no spread is known yet. */
function applyUserSpread(
  t: TickData,
  sp?: { effective_value: number; spread_type: string; pip_size: number },
): TickData {
  if (!sp) return t;
  const mid = (Number(t.bid) + Number(t.ask)) / 2;
  if (!(mid > 0)) return t;
  const spreadPrice = sp.spread_type === 'percentage'
    ? mid * (sp.effective_value / 100)
    : sp.effective_value * (sp.pip_size || 0.0001);
  if (!Number.isFinite(spreadPrice) || spreadPrice < 0) return t;
  return { ...t, bid: mid - spreadPrice / 2, ask: mid + spreadPrice / 2, spread: spreadPrice };
}

const lastAppliedTickTs = new Map<string, number>();   // last applied server ts (epoch ms)
const lastAppliedTickWall = new Map<string, number>(); // wall-clock of last apply (epoch ms)
const STALE_TICK_GRACE_MS = 3000;

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
  spread: number;
}

export interface Position {
  id: string;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  /** Display lots — what the trader typed (e.g. 0.01 on a cent
   *  account). Shown in the QTY column. */
  lots: number;
  /** Raw engine lots (e.g. 0.0001 on a cent account, multiplier 0.01).
   *  MUST be used for live P&L recompute — using `lots` overstates a
   *  cent position's P&L 100×. Falls back to `lots` when absent
   *  (standard accounts where the two are equal). */
  effective_lots?: number;
  open_price: number;
  current_price?: number;
  stop_loss?: number;
  take_profit?: number;
  swap: number;
  commission: number;
  profit: number;
  /** copy_trade | self_trade when API provides it (open positions / copy trading). */
  trade_type?: string;
  created_at: string;
  // Insurance markers per position — null when no active policy. Used
  // by PositionsPanel to render an "Insurance OK in 25s / Expires in
  // 2h 15m" countdown chip next to the close button.
  insurance_activated_at?: string | null;
  insurance_eligible_at?: string | null;
  insurance_expires_at?: string | null;
}

export interface PendingOrder {
  id: string;
  account_id: string;
  symbol: string;
  order_type: string;
  side: 'buy' | 'sell';
  status: string;
  lots: number;
  price: number;
  stop_loss?: number;
  take_profit?: number;
  created_at: string;
}

/** Account type (account_groups) — spreads / commission / min deposit configured in admin. */
export interface AccountGroupInfo {
  id: string;
  name: string;
  spread_markup: number;
  commission_per_lot: number;
  minimum_deposit: number;
  swap_free: boolean;
  leverage_default: number;
  /** Hard ceiling from migration 0020; falls back to leverage_default for legacy rows. */
  max_leverage?: number;
  /** Smaller of max_leverage and the per-user KYC cap (50 for non-KYC). Use this
   *  to clamp the leverage picker — leverage_default is just a UI hint, not the cap. */
  effective_max_leverage?: number;
  /** Cent-account display flag (Mig 0068). When true, the trader UI
   *  multiplies visible balance / equity / P&L by 100 and renders ¢. */
  is_cent_account?: boolean | null;
  /** Lot scaling factor (Mig 0069). 1 = no scaling. 0.01 = cent group:
   *  the order panel multiplies the margin preview + insurance quote
   *  lots by this so the displayed margin + the "Insufficient margin"
   *  gate match what the backend actually charges. */
  lot_size_multiplier?: number | null;
  /** Per-account-type insurance gate (Mig 0070). False = hide the
   *  Trade Insurance picker for accounts of this type. */
  insurance_enabled?: boolean | null;
}

export interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  margin_level: number;
  leverage: number;
  currency: string;
  is_demo: boolean;
  account_group?: AccountGroupInfo | null;
}

export interface InstrumentInfo {
  symbol: string;
  display_name: string;
  segment: string;
  digits: number;
  pip_size: number;
  min_lot: number;
  max_lot: number;
  lot_step: number;
  contract_size: number;
  base_currency?: string | null;
  quote_currency?: string | null;
}

/** One-shot prefill for order panel (clone from open position). */
export type OrderFormCloneDraft = {
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  stop_loss?: number | null;
  take_profit?: number | null;
};

interface TradingState {
  activeAccount: TradingAccount | null;
  accounts: TradingAccount[];
  positions: Position[];
  pendingOrders: PendingOrder[];
  selectedSymbol: string;
  prices: Record<string, TickData>;
  prevPrices: Record<string, number>;
  /** The logged-in user's OWN effective spread per symbol, resolved server-side
   *  through the full hierarchy (user → instrument → segment → default, with
   *  account-type rows beating wildcards). The shared price broadcast can only
   *  carry the wildcard spread, so we re-derive bid/ask from the broadcast MID
   *  using this — that's what makes the chart/P&L match each account type. */
  mySpreads: Record<string, { effective_value: number; spread_type: string; pip_size: number }>;
  loadMySpread: (symbol: string) => Promise<void>;
  watchlist: string[];
  instruments: InstrumentInfo[];

  setActiveAccount: (a: TradingAccount | null) => void;
  setAccounts: (a: TradingAccount[]) => void;
  setPositions: (p: Position[]) => void;
  setPendingOrders: (o: PendingOrder[]) => void;
  setSelectedSymbol: (s: string) => void;
  updatePrice: (t: TickData) => void;
  updatePrices: (t: TickData[]) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setInstruments: (i: InstrumentInfo[]) => void;
  removePosition: (id: string) => void;
  removeAccount: (id: string) => void;
  refreshPositions: () => Promise<void>;
  refreshPendingOrders: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  placeOrder: (data: {
    account_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    order_type: 'market' | 'limit' | 'stop' | 'stop_limit';
    lots: number;
    price?: number;
    stop_loss?: number;
    take_profit?: number;
    stop_limit_price?: number;
  }) => Promise<any>;

  orderFormCloneDraft: OrderFormCloneDraft | null;
  setOrderFormCloneDraft: (d: OrderFormCloneDraft | null) => void;
}

const DEFAULT_WATCHLIST = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
  'XAUUSD', 'XAGUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'SOLUSD',
  'US30', 'NAS100', 'GER40', 'EURJPY', 'GBPJPY',
];

const DEFAULT_SYMBOL = 'XAUUSD';
const SYMBOL_STORAGE_KEY = 'trader-selected-symbol';

function getPersistedSymbol(): string {
  if (typeof window === 'undefined') return DEFAULT_SYMBOL;
  try {
    return sessionStorage.getItem(SYMBOL_STORAGE_KEY) || DEFAULT_SYMBOL;
  } catch {
    return DEFAULT_SYMBOL;
  }
}

export const useTradingStore = create<TradingState>()((set, get) => ({
  activeAccount: null,
  accounts: [],
  positions: [],
  pendingOrders: [],
  selectedSymbol: getPersistedSymbol(),
  mySpreads: {},
  loadMySpread: async (symbol) => {
    const sym = String(symbol || '').trim().toUpperCase();
    if (!sym) return;
    const acct = get().activeAccount?.id;
    try {
      const q = acct ? `?account_id=${encodeURIComponent(acct)}` : '';
      const r = await api.get<{ effective_value: number; spread_type: string; pip_size: number }>(
        `/instruments/${encodeURIComponent(sym)}/my-spread${q}`,
      );
      if (!r || typeof r.effective_value !== 'number') return;
      set((s) => ({
        mySpreads: {
          ...s.mySpreads,
          [sym]: {
            effective_value: r.effective_value,
            spread_type: r.spread_type || 'pips',
            pip_size: r.pip_size || 0.0001,
          },
        },
      }));
    } catch {
      /* keep the broadcast quote as-is — never block pricing on this */
    }
  },
  prices: {},
  prevPrices: {},
  watchlist: DEFAULT_WATCHLIST,
  instruments: [],
  orderFormCloneDraft: null,

  setActiveAccount: (a) => set({ activeAccount: a }),
  setAccounts: (a) => set({ accounts: a }),
  setPositions: (p) => set({ positions: p }),
  setPendingOrders: (o) => set({ pendingOrders: o }),
  setSelectedSymbol: (s) => {
    set({ selectedSymbol: s });
    try { sessionStorage.setItem(SYMBOL_STORAGE_KEY, s); } catch {}
  },
  setInstruments: (i) => set({ instruments: i }),
  setOrderFormCloneDraft: (d) => set({ orderFormCloneDraft: d }),
  removePosition: (id) => set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),

  removeAccount: (id) =>
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      activeAccount: s.activeAccount?.id === id ? null : s.activeAccount,
    })),

  refreshPositions: async () => {
    const account = get().activeAccount;
    if (!account) return;
    try {
      const positions = await api.get<any[]>(`/positions/`, { account_id: account.id, status: 'open' });
      const list = Array.isArray(positions) ? positions : [];
      // Latest ticks/instruments so we can value each refreshed position at the
      // live MID immediately — otherwise the server's `profit` (often 0/stale
      // for a freshly-opened position) shows for ~1s until the next tick,
      // which is the "P&L flickers to zero" flash.
      const livePrices = get().prices;
      const liveInstruments = get().instruments;
      set({
        positions: list.map((p: any) => {
          const mapped = {
            id: p.id,
            account_id: p.account_id,
            symbol: p.symbol || '',
            side: p.side,
            lots: Number(p.lots) || 0,
            // Engine lots (0.0001 on a cent account). MUST be carried through
            // or the live P&L recompute below falls back to display `lots`
            // and a cent position's P&L jumps 100×. Was being dropped here.
            effective_lots: p.effective_lots != null ? Number(p.effective_lots) : undefined,
            open_price: Number(p.open_price) || 0,
            current_price: p.current_price != null ? Number(p.current_price) : undefined,
            stop_loss: p.stop_loss != null ? Number(p.stop_loss) : undefined,
            take_profit: p.take_profit != null ? Number(p.take_profit) : undefined,
            swap: Number(p.swap) || 0,
            commission: Number(p.commission) || 0,
            profit: Number(p.profit) || 0,
            trade_type: p.trade_type,
            created_at: p.created_at,
            // Insurance markers — without these the badge ALWAYS reads
            // "Not insured" and the countdown never renders (the backend
            // sends them; the mapper was silently discarding them).
            insurance_activated_at: p.insurance_activated_at ?? null,
            insurance_eligible_at: p.insurance_eligible_at ?? null,
            insurance_expires_at: p.insurance_expires_at ?? null,
          };
          const sym = (mapped.symbol || '').trim().toUpperCase();
          const r = livePnlFor(mapped, livePrices[sym], liveInstruments, sym, livePrices);
          return r ? { ...mapped, current_price: r.cp, profit: r.pnl } : mapped;
        }),
      });
    } catch (e) {
      // Silent-failure fix: a persistently failing refresh used to be
      // invisible — positions just froze. Log so it shows in devtools.
      console.warn('[tradingStore] refreshPositions failed:', e);
    }
  },

  refreshPendingOrders: async () => {
    const account = get().activeAccount;
    if (!account) return;
    try {
      const orders = await api.get<any[]>(`/orders/`, { account_id: account.id, status: 'pending' });
      const list = Array.isArray(orders) ? orders : [];
      set({
        pendingOrders: list.map((o: any) => ({
          id: String(o.id),
          account_id: String(o.account_id),
          symbol: String(o.symbol || (o.instrument as { symbol?: string })?.symbol || ''),
          order_type: String(o.order_type),
          side: o.side,
          status: String(o.status),
          lots: Number(o.lots) || 0,
          price: Number(o.price) || 0,
          stop_loss: o.stop_loss != null ? Number(o.stop_loss) : undefined,
          take_profit: o.take_profit != null ? Number(o.take_profit) : undefined,
          created_at: String(o.created_at ?? ''),
        })),
      });
    } catch (e) {
      console.warn('[tradingStore] refreshPendingOrders failed:', e);
    }
  },

  refreshAccount: async () => {
    const account = get().activeAccount;
    if (!account) return;
    try {
      const res = await api.get<any>('/accounts');
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      const updated = items.find((a: any) => a.id === account.id);
      if (updated) {
        set({
          activeAccount: {
            ...account,
            balance: Number(updated.balance) || 0,
            equity: Number(updated.equity) || 0,
            margin_used: Number(updated.margin_used) || 0,
            free_margin: Number(updated.free_margin) || 0,
            credit: Number(updated.credit) || 0,
            margin_level: Number(updated.margin_level) || 0,
            leverage: Number(updated.leverage) || account.leverage,
            account_group: updated.account_group ?? account.account_group,
          },
        });
      }
    } catch (e) {
      console.warn('[tradingStore] refreshAccount failed:', e);
    }
  },

  // Apply a whole tick burst in ONE store write. Every feed hands us an array
  // (the WS frame carries many symbols, `/instruments/prices/all` carries the
  // entire book), and the old per-tick loop meant N store writes → N price-map
  // spreads → N full `positions.map()` passes → N subscriber notifications per
  // burst. Same semantics per symbol as before, just accumulated first and
  // committed once. `updatePrice` below is the single-tick shim.
  updatePrices: (ticks) => set((state) => {
    if (!ticks || ticks.length === 0) return state;

    let nextPrices: Record<string, TickData> | null = null;
    let nextPrev: Record<string, number> | null = null;
    const touched = new Set<string>();
    const nowWall = Date.now();

    for (const tick of ticks) {
      const sym = String(tick?.symbol || '').trim().toUpperCase();
      if (!sym) continue;
      // Re-derive bid/ask from the broadcast MID using THIS user's resolved
      // spread, so the chart / P&L / panels reflect the spread their own account
      // type is configured for — the shared broadcast can only carry the wildcard
      // value (client 2026-07-22). The mid is unchanged, so anything computing
      // from the mid (e.g. OrderPanel) is unaffected. No spread loaded yet →
      // leave the broadcast quote untouched.
      const normalized: TickData = applyUserSpread({ ...tick, symbol: sym }, state.mySpreads[sym]);

      // Freshness guard (see lastAppliedTickTs above): drop the round-trip-stale
      // REST-poll value (or a duplicate re-publish) that flashed the P&L backward,
      // but only while a fresher tick is recent — after STALE_TICK_GRACE_MS of
      // silence, let it through so a dead socket falls back to the poll (no freeze).
      const ts = Date.parse(normalized.timestamp);
      const prevTs = lastAppliedTickTs.get(sym);
      const prevWall = lastAppliedTickWall.get(sym) ?? 0;
      if (Number.isFinite(ts) && prevTs !== undefined && ts <= prevTs
          && nowWall - prevWall < STALE_TICK_GRACE_MS) {
        continue; // stale/duplicate while a fresher value is live — ignore
      }
      lastAppliedTickWall.set(sym, nowWall);
      if (Number.isFinite(ts) && (prevTs === undefined || ts > prevTs)) {
        lastAppliedTickTs.set(sym, ts);
      }

      const prev = (nextPrices ?? state.prices)[sym];
      if (!nextPrices) nextPrices = { ...state.prices };
      nextPrices[sym] = normalized;
      if (prev) {
        if (!nextPrev) nextPrev = { ...state.prevPrices };
        nextPrev[sym] = prev.bid;
      }
      touched.add(sym);
    }

    if (!nextPrices) return state; // every tick was stale/duplicate

    // Re-value only the positions whose symbol moved in this burst. `nextPrices`
    // is the full map including the new ticks — passed to livePnlFor so a JPY
    // cross (GBPJPY etc.) can look up USDJPY to convert quote→USD.
    const applied = nextPrices;
    let positionsChanged = false;
    const positions = state.positions.map((pos) => {
      const pSym = String(pos.symbol || '').trim().toUpperCase();
      if (!touched.has(pSym)) return pos;
      // Value floating P&L via the shared helper (same "user close quote" basis
      // the backend uses) — keeps the frontend in lockstep with the backend so
      // the number doesn't snap on refresh.
      const r = livePnlFor(pos, applied[pSym], state.instruments, pSym, applied);
      if (!r) return pos;
      positionsChanged = true;
      return { ...pos, current_price: r.cp, profit: r.pnl };
    });

    return {
      prevPrices: nextPrev ?? state.prevPrices,
      prices: applied,
      // Keep the array identity when nothing was re-valued, so position
      // subscribers don't re-render on ticks for symbols they don't hold.
      positions: positionsChanged ? positions : state.positions,
    };
  }),

  updatePrice: (tick) => get().updatePrices([tick]),

  addToWatchlist: (s) => set((st) => ({
    watchlist: st.watchlist.includes(s) ? st.watchlist : [...st.watchlist, s],
  })),

  removeFromWatchlist: (s) => set((st) => ({
    watchlist: st.watchlist.filter((x) => x !== s),
  })),

  placeOrder: async (data) => {
    // Optimistic: market orders hit the book immediately — inject a position
    // row synchronously so the Positions panel reflects the trade without
    // waiting for the server round-trip.
    const s = get();
    const tick = s.prices[data.symbol];
    const optimisticId = `optim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    let rollback: (() => void) | null = null;
    if (data.order_type === 'market' && tick) {
      const execPrice = data.side === 'buy' ? tick.ask : tick.bid;
      const prev = s.positions;
      // Cent-account multiplier so the optimistic row's live P&L matches
      // the engine immediately (no 100× flash before the first refresh).
      const _mult = Number(s.activeAccount?.account_group?.lot_size_multiplier) || 1;
      const _dispLots = Number(data.lots) || 0;
      const optimisticPos = {
        id: optimisticId,
        account_id: data.account_id,
        symbol: data.symbol,
        side: data.side,
        lots: _dispLots,
        effective_lots: _dispLots * _mult,
        open_price: execPrice,
        current_price: execPrice,
        stop_loss: data.stop_loss,
        take_profit: data.take_profit,
        swap: 0,
        commission: 0,
        profit: 0,
        trade_type: 'self_trade',
        created_at: new Date().toISOString(),
      } as (typeof s.positions)[number];
      set({ positions: [optimisticPos, ...prev] });
      rollback = () => set({ positions: prev });
    }

    try {
      const res = await api.post<any>('/orders/', {
        account_id: data.account_id,
        symbol: data.symbol,
        side: data.side,
        order_type: data.order_type,
        lots: data.lots,
        price: data.price,
        stop_loss: data.stop_loss,
        take_profit: data.take_profit,
        stop_limit_price: data.stop_limit_price,
      });

      // Reconcile with server-authoritative state (replaces the optimistic row).
      Promise.all([get().refreshPositions(), get().refreshAccount()]).catch(() => {});

      return res;
    } catch (err) {
      if (rollback) rollback();
      throw err;
    }
  },
}));
