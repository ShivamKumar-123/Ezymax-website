import { create } from 'zustand';
import api from '@/lib/api/client';

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
  spread: number;
  // Server publish time (epoch ms), from the backend tick payload. Used as a
  // freshness key so a lagging REST poll can't overwrite a newer WS tick.
  ts_ms?: number;
  // True when the quote is a stale-refresher republish (dead upstream feed).
  stale?: boolean;
}

export interface Position {
  id: string;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
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
  /** True when this account is the user's single wallet-bound account
   *  — deposits route here directly and withdrawals leave from here
   *  back to the linked wallet. Exactly one active wallet-bound
   *  account allowed per user (enforced by partial unique index). */
  is_wallet_account?: boolean;
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

/** Pending SL/TP edit made by dragging the chart's bracket lines. The chart
 *  writes it on drag-release; the terminal sidebar shows it for review and
 *  either PUTs (confirm) or asks the chart to snap the lines back (discard).
 *  `undefined` = bracket untouched, `null` = remove bracket. `nonce` bumps on
 *  discard so the chart effect re-syncs lines to the server values. */
export type ChartExitsDraft = {
  positionId: string;
  takeProfit?: number | null;
  stopLoss?: number | null;
};

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
  watchlist: string[];
  instruments: InstrumentInfo[];
  /** optimistic "optim-…" id → the real server UUID it already resolves to.
   *  Populated by refreshPositions the moment a server row is matched, which
   *  is almost immediate — independent of the 5s FRESH_OPTIM_WINDOW_MS grace
   *  period that keeps the row DISPLAYED under its optimistic id to avoid a
   *  list remount. Lets SL/TP/close target the real position right away
   *  without waiting out that cosmetic delay. See resolvePositionId. */
  optimisticIdMap: Record<string, string>;

  setActiveAccount: (a: TradingAccount | null) => void;
  setAccounts: (a: TradingAccount[]) => void;
  setPositions: (p: Position[]) => void;
  setPendingOrders: (o: PendingOrder[]) => void;
  setSelectedSymbol: (s: string) => void;
  /** Fold a whole WS payload into ONE store commit (one render pass). */
  updatePrices: (ticks: TickData[]) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setInstruments: (i: InstrumentInfo[]) => void;
  removePosition: (id: string) => void;
  updatePosition: (id: string, patch: Partial<Position>) => void;
  removeAccount: (id: string) => void;
  refreshPositions: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  /** Real id to use for an API call against `id` — itself if already real,
   *  else the server UUID from optimisticIdMap once known, else `id`
   *  unchanged (still genuinely unresolved; caller should treat as pending). */
  resolvePositionId: (id: string) => string;
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
  }) => Promise<unknown>;

  orderFormCloneDraft: OrderFormCloneDraft | null;
  setOrderFormCloneDraft: (d: OrderFormCloneDraft | null) => void;
  /** Chart-driven review state shown in the terminal sidebar. */
  chartExitsDraft: ChartExitsDraft | null;
  setChartExitsDraft: (d: ChartExitsDraft | null) => void;
  chartCloseRequest: string | null;
  setChartCloseRequest: (positionId: string | null) => void;
  /** Incremented whenever a draft is discarded — chart lines re-sync to server values. */
  chartLinesResetNonce: number;
  bumpChartLinesReset: () => void;
}

const DEFAULT_WATCHLIST = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
  'XAUUSD', 'XAGUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'SOLUSD',
  'US30', 'NAS100', 'GER40', 'EURJPY', 'GBPJPY',
];

const DEFAULT_SYMBOL = 'XAUUSD';
const SYMBOL_STORAGE_KEY = 'swisscresta-selected-symbol';

function getPersistedSymbol(): string {
  if (typeof window === 'undefined') return DEFAULT_SYMBOL;
  try {
    return sessionStorage.getItem(SYMBOL_STORAGE_KEY) || DEFAULT_SYMBOL;
  } catch {
    return DEFAULT_SYMBOL;
  }
}

// ── Tick application (pure) ─────────────────────────────────────────────────
// Called by updatePrices once per tick of a batched payload.
// Returns the changed slices, or null when the tick is a no-op (bad symbol /
// stale by server timestamp). Perf contract: the returned `positions` is the
// SAME array reference unless a position actually trades this symbol, so
// positions-subscribers don't re-render on unrelated ticks.
type TickSlices = Pick<TradingState, 'prices' | 'prevPrices' | 'positions'>;

function applyTick(
  state: TickSlices & Pick<TradingState, 'instruments'>,
  tick: TickData,
): TickSlices | null {
  const sym = String(tick.symbol || '').trim().toUpperCase();
  if (!sym) return null;
  const normalized: TickData = { ...tick, symbol: sym };
  const prev = state.prices[sym];
  // Freshness guard: the WS feed and the ~1.5s REST poll both call this, and
  // a lagging poll response can carry an OLDER snapshot than a WS tick that
  // already landed. Never let an older server publish time overwrite a newer
  // one — otherwise the price (and every position's P&L) visibly bounces
  // backward. Only enforced when both ticks carry a server ts_ms; if either
  // is missing (legacy payload) we fail open and accept the update.
  const incomingTs = Number(normalized.ts_ms) || 0;
  const prevTs = Number(prev?.ts_ms) || 0;
  if (prev && incomingTs && prevTs && incomingTs < prevTs) {
    return null;
  }
  const touchesPosition = state.positions.some(
    (pos) => String(pos.symbol || '').trim().toUpperCase() === sym,
  );
  return {
    prevPrices: prev
      ? { ...state.prevPrices, [sym]: prev.bid }
      : state.prevPrices,
    prices: { ...state.prices, [sym]: normalized },
    positions: !touchesPosition ? state.positions : state.positions.map((pos) => {
      const pSym = String(pos.symbol || '').trim().toUpperCase();
      if (pSym !== sym) return pos;
      const cp = pos.side === 'buy' ? normalized.bid : normalized.ask;
      const inst =
        state.instruments.find((i) => i.symbol === sym) ||
        state.instruments.find((i) => String(i.symbol).toUpperCase() === sym);
      const cs = inst?.contract_size || 100000;
      let pnl = pos.side === 'buy'
        ? (cp - pos.open_price) * pos.lots * cs
        : (pos.open_price - cp) * pos.lots * cs;
      // Forex P&L formula yields a value in the QUOTE currency. Convert to
      // the account currency (USD) so e.g. USDJPY shows ~$0.006 instead of
      // 1 JPY rendered as "$1". For pairs already quoted in USD (EURUSD,
      // GBPUSD, XAUUSD, BTCUSD…) this is a no-op.
      const base = (inst?.base_currency || (sym.length >= 6 ? sym.slice(0, 3) : '')).toUpperCase();
      const quote = (inst?.quote_currency || (sym.length >= 6 ? sym.slice(3, 6) : '')).toUpperCase();
      // `pnlUsdReady` tells us whether the value in `pnl` is already in
      // USD. We only overwrite pos.profit when it is — otherwise we
      // leave the server's correctly-converted profit alone.
      let pnlUsdReady = !quote || quote === 'USD';
      if (!pnlUsdReady) {
        if (base === 'USD' && cp) {
          pnl = pnl / cp;
          pnlUsdReady = true;
        } else {
          // Cross pair (e.g. GBPJPY, EURJPY) — convert QUOTE → USD
          // through whichever USD pair we already have streaming.
          // USDJPY is in the default watchlist, so JPY crosses are
          // covered once that tick arrives.
          const usdQuote = state.prices[`USD${quote}`];
          if (usdQuote && usdQuote.bid) {
            pnl = pnl / usdQuote.bid;
            pnlUsdReady = true;
          } else {
            const quoteUsd = state.prices[`${quote}USD`];
            if (quoteUsd && quoteUsd.bid) {
              pnl = pnl * quoteUsd.bid;
              pnlUsdReady = true;
            }
          }
        }
      }
      // Race fix: at page-load the position's symbol may tick BEFORE
      // the cross-rate symbol does (e.g. GBPJPY ticks before USDJPY
      // arrives). Without this guard we'd overwrite the server's
      // correctly-USD-converted profit with the raw quote-currency
      // number for that brief window — making the P&L bounce between
      // "-$0.66" and "-$89" until USDJPY finally streams in. Now we
      // only overwrite when we actually have a USD value to write.
      return pnlUsdReady
        ? { ...pos, current_price: cp, profit: pnl }
        : { ...pos, current_price: cp };
    }),
  };
}

export const useTradingStore = create<TradingState>()((set, get) => ({
  activeAccount: null,
  accounts: [],
  positions: [],
  pendingOrders: [],
  selectedSymbol: getPersistedSymbol(),
  prices: {},
  prevPrices: {},
  watchlist: DEFAULT_WATCHLIST,
  instruments: [],
  optimisticIdMap: {},
  orderFormCloneDraft: null,
  chartExitsDraft: null,
  chartCloseRequest: null,
  chartLinesResetNonce: 0,

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
  setChartExitsDraft: (d) => set({ chartExitsDraft: d }),
  setChartCloseRequest: (positionId) => set({ chartCloseRequest: positionId }),
  bumpChartLinesReset: () => set((s) => ({ chartLinesResetNonce: s.chartLinesResetNonce + 1 })),
  removePosition: (id) => set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),
  // Optimistically patch one position (e.g. SL/TP just set from the chart) so
  // the chart line + positions row update instantly, before the PUT round-trips.
  updatePosition: (id, patch) => set((s) => ({
    positions: s.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  })),

  removeAccount: (id) =>
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      activeAccount: s.activeAccount?.id === id ? null : s.activeAccount,
    })),

  refreshPositions: async () => {
    const account = get().activeAccount;
    if (!account) return;
    try {
      /* Backend returns positions as a JSON array. We narrow per-field
       * below via Number()/as casts; typing the wire as Record keeps
       * the optimistic-merge logic compatible without inventing a
       * full PositionApiRow contract we can't verify. */
      const positions = await api.get<Record<string, unknown>[]>(`/positions/`, { account_id: account.id, status: 'open' });
      const list = Array.isArray(positions) ? positions : [];

      // Merge instead of replace — preserves React keys for any
      // optimistic positions still in flight, eliminating the flicker
      // when a freshly-opened trade transitions from optim-xxx to its
      // real server UUID. The poll fires every 1.5s; without this
      // merge, every poll briefly unmounts + remounts every row.
      //
      // Match heuristic: optimistic position (id prefix "optim-")
      // matches a server position by account_id + symbol + side + lots
      // AND must be FRESH — created within the last 5 seconds. Without
      // the freshness cap a user who rapid-fires 88 identical trades
      // ends up with 88 optim-* ids that never reconcile to real UUIDs
      // because every server row keeps matching the still-present
      // optimistic rows, so bulk close (which filters out optim ids)
      // can't act on any of them.
      const prevPositions = get().positions;
      const FRESH_OPTIM_WINDOW_MS = 5_000;
      const now = Date.now();
      const optimisticPrev = prevPositions.filter((p) => {
        if (!p.id.startsWith('optim-')) return false;
        const t = p.created_at ? Date.parse(p.created_at) : 0;
        return Number.isFinite(t) && now - t < FRESH_OPTIM_WINDOW_MS;
      });
      const optimMatched = new Set<string>();
      // optim id -> real id, for every match found THIS pass — independent
      // of the freshness window, which only decides the DISPLAYED id.
      const resolvedThisPass: Record<string, string> = {};

      const merged = list.map((p: Record<string, unknown>) => {
        const serverPos = {
          id: p.id as string,
          account_id: p.account_id as string,
          symbol: (p.symbol || '') as string,
          side: p.side as 'buy' | 'sell',
          lots: Number(p.lots) || 0,
          open_price: Number(p.open_price) || 0,
          current_price: p.current_price != null ? Number(p.current_price) : undefined,
          stop_loss: p.stop_loss != null ? Number(p.stop_loss) : undefined,
          take_profit: p.take_profit != null ? Number(p.take_profit) : undefined,
          swap: Number(p.swap) || 0,
          commission: Number(p.commission) || 0,
          profit: Number(p.profit) || 0,
          trade_type: p.trade_type as string | undefined,
          created_at: p.created_at as string,
        };
        // Try to inherit an unmatched optimistic position's key so the
        // React row stays mounted across the optim → real transition.
        const candidate = optimisticPrev.find((opt) =>
          !optimMatched.has(opt.id) &&
          opt.account_id === serverPos.account_id &&
          opt.symbol === serverPos.symbol &&
          opt.side === serverPos.side &&
          Math.abs(opt.lots - serverPos.lots) < 1e-8,
        );
        if (candidate) {
          optimMatched.add(candidate.id);
          // The row keeps showing `candidate.id` (no remount), but the real
          // id is known NOW — record it so SL/TP/close can act immediately
          // instead of waiting out the freshness window.
          resolvedThisPass[candidate.id] = serverPos.id;
          return { ...serverPos, id: candidate.id };
        }
        return serverPos;
      });

      // Preserve any fresh optimistic rows that didn't find a server
      // twin in this snapshot. The position was just placed and the
      // server's /positions view may simply not have caught up yet
      // (poll ticks at 1.5s, fill may not be visible for a few hundred
      // ms after POST /orders/). Without this, the optim row gets
      // dropped here and reappears once the server catches up next
      // tick — a visible flicker on every freshly opened trade.
      const orphanedOptimistic = optimisticPrev.filter((p) => !optimMatched.has(p.id));
      const finalPositions = orphanedOptimistic.length
        ? [...orphanedOptimistic, ...merged]
        : merged;

      // Merge the newly-resolved ids into the map, and drop any entry whose
      // optimistic key no longer appears in the live list at all — either it
      // graduated to its real id (no longer needed) or the position closed
      // before ever settling. Unbounded otherwise: a rejected/instantly-
      // closed optimistic row would never be matched again to trigger its
      // own removal.
      const finalIds = new Set(finalPositions.map((p) => p.id));
      const prevMap = get().optimisticIdMap;
      const nextMap: Record<string, string> = { ...prevMap, ...resolvedThisPass };
      for (const optimId of Object.keys(nextMap)) {
        if (!finalIds.has(optimId)) delete nextMap[optimId];
      }

      set({ positions: finalPositions, optimisticIdMap: nextMap });
    } catch {}
  },

  resolvePositionId: (id) => {
    if (!id.startsWith('optim-')) return id;
    return get().optimisticIdMap[id] ?? id;
  },

  refreshAccount: async () => {
    const account = get().activeAccount;
    if (!account) return;
    try {
      const res = await api.get<unknown>('/accounts');
      const items: Record<string, unknown>[] = Array.isArray(res)
        ? res
        : ((res as { items?: Record<string, unknown>[] } | null)?.items ?? []);
      const updated = items.find((a) => a.id === account.id);
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
            account_group: (updated.account_group as AccountGroupInfo | null | undefined) ?? account.account_group,
          },
        });
      }
    } catch {}
  },

  updatePrices: (ticks) => set((state) => {
    // Fold every tick of the payload into ONE partial-state commit — the old
    // per-tick loop in callers produced one render pass per symbol.
    let prices = state.prices;
    let prevPrices = state.prevPrices;
    let positions = state.positions;
    let changed = false;
    for (const t of ticks || []) {
      const next = applyTick(
        { prices, prevPrices, positions, instruments: state.instruments },
        t,
      );
      if (next) {
        prices = next.prices;
        prevPrices = next.prevPrices;
        positions = next.positions;
        changed = true;
      }
    }
    return changed ? { prices, prevPrices, positions } : state;
  }),

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
      const optimisticPos = {
        id: optimisticId,
        account_id: data.account_id,
        symbol: data.symbol,
        side: data.side,
        lots: Number(data.lots) || 0,
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
      const res = await api.post<unknown>('/orders/', {
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

      // The order response already carries the REAL position_id (plus the fill
      // price and commission), so promote the optimistic row IN PLACE instead of
      // waiting on a refresh round-trip. This matters for more than tidiness:
      // the chart deliberately skips optimistic rows (their `optim-…` id isn't a
      // valid UUID and blows up the modify endpoint), so until the row carries a
      // real id there is no position line and no SL/TP controls — which is the
      // lag you feel between tapping BUY and the line appearing.
      const r = (res ?? {}) as Record<string, unknown>;
      const realId = r.position_id ? String(r.position_id) : '';
      if (rollback && realId) {
        const filled = Number(r.filled_price);
        set({
          positions: get().positions.map((p) =>
            p.id === optimisticId
              ? {
                  ...p,
                  id: realId,
                  open_price: Number.isFinite(filled) && filled > 0 ? filled : p.open_price,
                  commission: Number(r.commission) || 0,
                }
              : p,
          ),
        });
      }

      // Still reconcile in the background for server-authoritative numbers
      // (margin, equity, swap) — but the UI no longer waits on it.
      Promise.all([get().refreshPositions(), get().refreshAccount()]).catch(() => {});

      return res;
    } catch (err) {
      if (rollback) rollback();
      throw err;
    }
  },
}));
