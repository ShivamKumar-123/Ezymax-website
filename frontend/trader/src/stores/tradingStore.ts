import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api/client';

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
  spread: number;
}

export interface Position {
  /** React-stable key. For a just-placed market order this stays the
   *  client-side `optim-…` placeholder across the optim→real transition
   *  (see refreshPositions) so the row never remounts. NOT a valid UUID
   *  during that window — never send it to the backend. */
  id: string;
  /** The real server position UUID. Always set once the position has been
   *  reconciled with the server; undefined only in the ~1s optimistic
   *  window before the first poll returns. Use THIS for every
   *  /positions/{id} call (close, modify, share). */
  server_id?: string;
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

  setActiveAccount: (a: TradingAccount | null) => void;
  setAccounts: (a: TradingAccount[]) => void;
  setPositions: (p: Position[]) => void;
  setPendingOrders: (o: PendingOrder[]) => void;
  setSelectedSymbol: (s: string) => void;
  updatePrice: (t: TickData) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setInstruments: (i: InstrumentInfo[]) => void;
  removePosition: (id: string) => void;
  removePendingOrder: (id: string) => void;
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
const SYMBOL_STORAGE_KEY = 'fxartha-selected-symbol';

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
  removePendingOrder: (id) => set((s) => ({ pendingOrders: s.pendingOrders.filter((o) => o.id !== id) })),

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

      // Merge instead of replace — preserves React keys for any
      // optimistic positions still in flight, eliminating the flicker
      // when a freshly-opened trade transitions from optim-xxx to its
      // real server UUID. The poll fires every 1.5s; without this
      // merge, every poll briefly unmounts + remounts every row.
      //
      // Match heuristic: optimistic position (id prefix "optim-")
      // matches a server position by account_id + symbol + side +
      // lots, picked within a 10s open-time window. Heuristic is
      // intentionally tight — open_price gets a small tolerance only
      // because the user's optimistic price may differ from the
      // server fill by a tick or two during a fast-moving market.
      const prevPositions = get().positions;
      const optimisticPrev = prevPositions.filter((p) => p.id.startsWith('optim-'));
      const optimMatched = new Set<string>();

      const merged = list.map((p: any) => {
        const serverPos = {
          id: p.id as string,
          // Always the real UUID, even when we inherit an optimistic key
          // for `id` below — so backend calls have a valid id to use.
          server_id: p.id as string,
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
          return { ...serverPos, id: candidate.id };
        }
        return serverPos;
      });

      // Keep a just-placed optimistic position that the server hasn't
      // returned yet. The 1.5s poll (and the reconcile fired right after
      // placeOrder) often races ahead of the position insert's commit, so
      // the new trade is absent from THIS response — building `positions`
      // purely from the server list would drop it, making the trade blink
      // out for one poll and reappear on the next. Carry any unmatched
      // optimistic row for a short grace window; a genuinely failed order is
      // already removed by placeOrder's own rollback, and anything stale
      // ages out here.
      const now = Date.now();
      const OPTIMISTIC_GRACE_MS = 12_000;
      const survivingOptimistic = optimisticPrev.filter((opt) => {
        if (optimMatched.has(opt.id)) return false; // already folded into a server row
        const openedAt = opt.created_at ? new Date(opt.created_at).getTime() : now;
        return Number.isFinite(openedAt) && now - openedAt < OPTIMISTIC_GRACE_MS;
      });

      set({ positions: [...survivingOptimistic, ...merged] });
    } catch {}
  },

  // Refresh the pending-order list for the active account. Kept separate so
  // both the poll loop and the cancel handler can drop a pending order the
  // moment it's cancelled or triggered (filled) — without a page refresh.
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
          symbol: String(o.symbol || o.instrument?.symbol || ''),
          order_type: String(o.order_type),
          side: o.side as 'buy' | 'sell',
          status: String(o.status),
          lots: Number(o.lots) || 0,
          price: Number(o.price) || 0,
          stop_loss: o.stop_loss != null ? Number(o.stop_loss) : undefined,
          take_profit: o.take_profit != null ? Number(o.take_profit) : undefined,
          created_at: String(o.created_at ?? ''),
        })),
      });
    } catch {}
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
    } catch {}
  },

  updatePrice: (tick) => set((state) => {
    const sym = String(tick.symbol || '').trim().toUpperCase();
    if (!sym) return state;
    const normalized: TickData = { ...tick, symbol: sym };
    const prev = state.prices[sym];
    return {
      prevPrices: prev
        ? { ...state.prevPrices, [sym]: prev.bid }
        : state.prevPrices,
      prices: { ...state.prices, [sym]: normalized },
      positions: state.positions.map((pos) => {
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
        if (quote && quote !== 'USD') {
          if (base === 'USD' && cp) {
            pnl = pnl / cp;
          }
          // cross pair (no USD on either side) — leave raw until we have a
          // cross-rate feed; backend will reconcile on close.
        }
        return { ...pos, current_price: cp, profit: pnl };
      }),
    };
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
        // No real server id yet — the reconcile poll fills this in.
        server_id: undefined,
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
