/**
 * TradingView Trading Terminal — Broker Adapter (ezymex).
 *
 * Wires the licensed charting_library (Trading Terminal edition, v31) broker
 * API to OUR trading backend so each open position renders on the chart as:
 *   • an entry-price line (BUY/SELL coloured) with a live P&L pill + ✕ close,
 *   • a draggable STOP-LOSS line, and
 *   • a draggable TAKE-PROFIT line.
 * Dragging a bracket line calls PUT /positions/{id} — modifying the REAL
 * server position. A rejected level snaps back (we re-push the old position).
 *
 * Ported from the reference platform's broker.ts and adapted for our store:
 * our Position.id is a STABLE react key (may be an `optim-…` placeholder),
 * while Position.server_id is ALWAYS the real UUID. TV lines are keyed by the
 * stable id (no flicker across the optim→real transition); every /positions/*
 * call resolves to server_id. A position without a server_id yet (the ~1s
 * optimistic window) can't be modified — we reject and snap back.
 */
import { useTradingStore } from '@/stores/tradingStore';
import api from '@/lib/api/client';

/* ─── TV enums (mirrored from charting_library.d.ts) ─── */
const OrderSide = { Buy: 1, Sell: -1 } as const;
const OrderType = { Market: 1, Limit: 2, Stop: 3, StopLimit: 4 } as const;
const OrderStatus = { Canceled: 1, Filled: 2, Inactive: 3, Placing: 4, Rejected: 5, Working: 6 } as const;
const ParentType = { Order: 1, Position: 2 } as const;
const ConnectionStatus = { Connected: 1, Connecting: 2, Disconnected: 3, Error: 4 } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _host: any = null;
let _currentAccountId = '';

function getActiveAccount() {
  return useTradingStore.getState().activeAccount;
}
function getPositions() {
  return useTradingStore.getState().positions;
}
function getPrices() {
  return useTradingStore.getState().prices;
}

/** Resolve a TV-facing position id (our stable `id`) to the real server UUID
 *  used for every /positions/{id} call. Returns null for a position that has
 *  no server id yet (still optimistic) — the caller must reject such edits. */
function resolveServerId(tvId: string): string | null {
  const p = getPositions().find((x) => x.id === tvId || x.server_id === tvId);
  return p?.server_id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBroker(host: any): any {
  _host = host;
  const acc = getActiveAccount();
  _currentAccountId = acc?.id || '';

  // Push live updates to TV's broker host. The chart renders:
  //   1) position entry line — from positionUpdate(...)
  //   2) live P&L pill on the line — from plUpdate(id, pl)  (store recomputes
  //      pos.profit on every tick, so this is genuinely live)
  //   3) draggable SL / TP lines — from the bracket child orders in orders()
  // When the position SET changes (open/close), positionUpdate alone won't
  // make TV pick up a new id — we must call positionsFullUpdate() +
  // ordersFullUpdate() so TV re-calls positions()/orders() and draws the new
  // lines. Diff by id-set so the full update only fires on real change.
  const prevPosIds = new Set<string>();
  setInterval(() => {
    try {
      if (!getActiveAccount()) return;
      const positions = getPositions();
      const prices = getPrices();

      const curIds = new Set(positions.map((p) => p.id));
      const changed =
        curIds.size !== prevPosIds.size || positions.some((p) => !prevPosIds.has(p.id));
      if (changed) {
        prevPosIds.clear();
        for (const id of curIds) prevPosIds.add(id);
        _host?.positionsFullUpdate?.();
        _host?.ordersFullUpdate?.();
      }

      for (const pos of positions) {
        const tick = prices[pos.symbol];
        const cp = tick ? (pos.side === 'buy' ? tick.bid : tick.ask) : undefined;
        _host?.positionUpdate?.({
          id: pos.id,
          symbol: pos.symbol,
          side: pos.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          qty: pos.lots,
          avgPrice: pos.open_price,
          pl: pos.profit || 0,
          ...(cp != null ? { last: cp } : {}),
        });
        _host?.plUpdate?.(pos.id, pos.profit || 0);
      }

      const a = getActiveAccount();
      if (a) _host?.equityUpdate?.(a.equity ?? a.balance ?? 0);
    } catch {
      /* host not ready / transient */
    }
  }, 1000);

  // ── Bracket-order encoding ──────────────────────────────────────────────
  // TV draws the labelled SL/TP lines from child orders attached to a position
  // via parentId + parentType. We synthesise these from each position's
  // stop_loss / take_profit. IDs are stable (`{id}__sl` / `{id}__tp`) so TV
  // diffs them and only redraws when the price changes.
  const slId = (posId: string) => `${posId}__sl`;
  const tpId = (posId: string) => `${posId}__tp`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildBracketOrders(): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any[] = [];
    for (const p of getPositions()) {
      const oppSide = p.side === 'buy' ? OrderSide.Sell : OrderSide.Buy;
      if (p.stop_loss != null) {
        out.push({
          id: slId(p.id), parentId: p.id, parentType: ParentType.Position,
          symbol: p.symbol, type: OrderType.Stop, side: oppSide,
          qty: p.lots, stopPrice: p.stop_loss, status: OrderStatus.Working,
        });
      }
      if (p.take_profit != null) {
        out.push({
          id: tpId(p.id), parentId: p.id, parentType: ParentType.Position,
          symbol: p.symbol, type: OrderType.Limit, side: oppSide,
          qty: p.lots, limitPrice: p.take_profit, status: OrderStatus.Working,
        });
      }
    }
    return out;
  }
  function bracketParentAndKind(id: string): { tvPosId: string; kind: 'sl' | 'tp' } | null {
    if (id.endsWith('__sl')) return { tvPosId: id.slice(0, -4), kind: 'sl' };
    if (id.endsWith('__tp')) return { tvPosId: id.slice(0, -4), kind: 'tp' };
    return null;
  }

  // Re-push the current server truth for one position so a rejected drag snaps
  // the line back to where it actually is. Called after a 4xx from the modify
  // endpoint. Uses ordersFullUpdate so TV re-reads the bracket child orders.
  function snapBack() {
    _host?.positionsFullUpdate?.();
    _host?.ordersFullUpdate?.();
  }

  // Shared SL/TP modify — the single path a dragged bracket, the Edit-position
  // dialog and the cancel(remove-line) action all funnel through. Resolves the
  // server id, PUTs, refreshes the store, and on rejection surfaces the
  // server's message and snaps the line back.
  async function putBrackets(tvPosId: string, stopLoss: number | null, takeProfit: number | null) {
    const serverId = resolveServerId(tvPosId);
    if (!serverId) {
      _host?.showNotification?.('Modify Failed', 'Position is still being registered — try again in a moment.', 0);
      snapBack();
      throw new Error('no server id');
    }
    try {
      await api.put(`/positions/${serverId}`, { stop_loss: stopLoss, take_profit: takeProfit });
      await useTradingStore.getState().refreshPositions().catch(() => {});
      _host?.ordersFullUpdate?.();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'This level was rejected';
      _host?.showNotification?.('Modify Rejected', msg, 0);
      // Never leave an unaccepted level drawn — re-push the OLD truth.
      snapBack();
      throw e;
    }
  }

  return {
    /* ─── Connection ─── */
    connectionStatus(): number {
      return ConnectionStatus.Connected;
    },

    /* ─── Account ─── */
    accountsMetainfo(): Promise<unknown[]> {
      const a = getActiveAccount();
      if (!a) return Promise.resolve([]);
      return Promise.resolve([{
        id: a.id,
        name: `${a.account_number} (${a.is_demo ? 'Demo' : 'Live'})`,
        currency: a.currency || 'USD',
      }]);
    },
    currentAccount(): string {
      return _currentAccountId || getActiveAccount()?.id || '';
    },
    setCurrentAccount(accountId: string) {
      _currentAccountId = accountId;
    },
    accountManagerInfo() {
      const a = getActiveAccount();
      return {
        accountTitle: 'Trading',
        summary: [
          { text: 'Balance', wValue: a?.balance ?? 0, formatter: 'fixed', isDefault: true },
          { text: 'Equity', wValue: a?.equity ?? 0, formatter: 'fixed' },
          { text: 'P&L', wValue: 0, formatter: 'profit' },
        ],
        orderColumns: [
          { label: 'Symbol', id: 'symbol', dataFields: ['symbol'] },
          { label: 'Side', id: 'side', dataFields: ['side'], formatter: 'side' },
          { label: 'Qty', id: 'qty', dataFields: ['qty'], formatter: 'fixed' },
          { label: 'Price', id: 'limitPrice', dataFields: ['limitPrice'], formatter: 'formatPrice' },
          { label: 'Status', id: 'status', dataFields: ['status'], formatter: 'status' },
        ],
        positionColumns: [
          { label: 'Symbol', id: 'symbol', dataFields: ['symbol'] },
          { label: 'Side', id: 'side', dataFields: ['side'], formatter: 'side' },
          { label: 'Qty', id: 'qty', dataFields: ['qty'], formatter: 'fixed' },
          { label: 'Avg Price', id: 'avgPrice', dataFields: ['avgPrice'], formatter: 'formatPrice' },
          { label: 'P&L', id: 'pl', dataFields: ['pl'], formatter: 'profit' },
        ],
      };
    },

    /* ─── Orders ─── */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async orders(): Promise<any[]> {
      const a = getActiveAccount();
      if (!a) return buildBracketOrders();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pending: any[] = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await api.get<any>('/orders/', { account_id: a.id, status: 'pending' });
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pending = items.map((o: any) => ({
          id: o.id, symbol: o.symbol,
          side: o.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          type: o.order_type === 'limit' ? OrderType.Limit : o.order_type === 'stop' ? OrderType.Stop : OrderType.Market,
          qty: o.lots, limitPrice: o.price, stopPrice: o.stop_price,
          status: OrderStatus.Working, filledQty: 0,
        }));
      } catch {
        /* no pending-orders endpoint / none — brackets still render below */
      }
      // Bracket child orders after the pending list → TV renders them as the
      // draggable SL/TP lines (parentType=Position), not standalone orders.
      return [...pending, ...buildBracketOrders()];
    },

    /* ─── Positions ─── */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async positions(): Promise<any[]> {
      const positions = getPositions();
      const prices = getPrices();
      return positions.map((p) => {
        const tick = prices[p.symbol];
        const cp = tick ? (p.side === 'buy' ? tick.bid : tick.ask) : p.current_price || p.open_price;
        return {
          id: p.id, symbol: p.symbol,
          side: p.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          qty: p.lots, avgPrice: p.open_price, pl: p.profit || 0, last: cp,
        };
      });
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async executions(symbol: string): Promise<any[]> {
      // Entry markers on the candle where each position opened.
      const positions = getPositions().filter((p) => p.symbol === symbol);
      return positions.map((p) => ({
        symbol: p.symbol, price: p.open_price,
        time: new Date(p.created_at || Date.now()).getTime(),
        side: p.side === 'buy' ? OrderSide.Buy : OrderSide.Sell, qty: p.lots,
      }));
    },

    /* ─── Trade actions ─── */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async placeOrder(order: any): Promise<{ orderId: string }> {
      const a = getActiveAccount();
      if (!a) throw new Error('No active account');
      const sym = order.symbol?.includes(':') ? order.symbol.split(':').pop() : order.symbol;
      const side = order.side === OrderSide.Buy ? 'buy' : 'sell';
      const isMarket = order.type === OrderType.Market;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        account_id: a.id, symbol: sym, side,
        order_type: isMarket ? 'market' : order.type === OrderType.Limit ? 'limit' : 'stop',
        lots: order.qty,
      };
      if (!isMarket && order.limitPrice) body.price = order.limitPrice;
      if (order.stopPrice) body.stop_price = order.stopPrice;
      if (order.stopLoss) body.stop_loss = order.stopLoss;
      if (order.takeProfit) body.take_profit = order.takeProfit;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await api.post<any>('/orders/', body);
        const orderId = res?.id || res?.order_id || `tv_${Date.now()}`;
        if (isMarket && res?.position_id) {
          const fillPx = res?.filled_price || res?.fill_price || res?.avg_price || res?.price || 0;
          _host?.orderUpdate?.({
            id: orderId, symbol: sym, side: order.side, type: OrderType.Market,
            qty: order.qty, status: OrderStatus.Filled, filledQty: order.qty, avgPrice: fillPx,
          });
          setTimeout(() => {
            useTradingStore.getState().refreshPositions().catch(() => {});
            _host?.ordersFullUpdate?.();
          }, 300);
        }
        return { orderId };
      } catch (e: unknown) {
        _host?.showNotification?.('Order Failed', (e as { message?: string })?.message || 'Could not place order', 0);
        throw e;
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async modifyOrder(order: any): Promise<void> {
      // Dragging a bracket SL/TP line routes here. Resolve to the parent
      // position and go through editPositionBrackets (the synthetic bracket
      // "orders" have no server-side order row — they are position fields).
      const meta = bracketParentAndKind(order.id);
      if (meta) {
        const newPrice = meta.kind === 'sl' ? order.stopPrice : order.limitPrice;
        const pos = getPositions().find((p) => p.id === meta.tvPosId);
        const sl = meta.kind === 'sl' ? newPrice : pos?.stop_loss ?? null;
        const tp = meta.kind === 'tp' ? newPrice : pos?.take_profit ?? null;
        await putBrackets(meta.tvPosId, sl ?? null, tp ?? null);
        return;
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: any = {};
        if (order.limitPrice != null) body.price = order.limitPrice;
        if (order.stopPrice != null) body.stop_price = order.stopPrice;
        if (order.qty != null) body.lots = order.qty;
        await api.put(`/orders/${order.id}`, body);
        _host?.orderUpdate?.({ ...order, status: OrderStatus.Working });
      } catch (e: unknown) {
        _host?.showNotification?.('Modify Failed', (e as { message?: string })?.message || 'Failed', 0);
        throw e;
      }
    },

    async cancelOrder(orderId: string): Promise<void> {
      // Removing an SL/TP line clears the corresponding field on the parent
      // position (synthetic bracket — no order row to delete).
      const meta = bracketParentAndKind(orderId);
      if (meta) {
        const pos = getPositions().find((p) => p.id === meta.tvPosId);
        const sl = meta.kind === 'sl' ? null : pos?.stop_loss ?? null;
        const tp = meta.kind === 'tp' ? null : pos?.take_profit ?? null;
        await putBrackets(meta.tvPosId, sl, tp);
        _host?.orderUpdate?.({ id: orderId, status: OrderStatus.Canceled });
        return;
      }
      try {
        await api.delete(`/orders/${orderId}`);
        _host?.orderUpdate?.({ id: orderId, status: OrderStatus.Canceled });
      } catch (e: unknown) {
        _host?.showNotification?.('Cancel Failed', (e as { message?: string })?.message || 'Failed', 0);
        throw e;
      }
    },

    // Drag-edit / "Edit position…" dialog for SL/TP.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async editPositionBrackets(positionId: string, brackets: any): Promise<void> {
      await putBrackets(positionId, brackets?.stopLoss ?? null, brackets?.takeProfit ?? null);
    },

    async closePosition(positionId: string, amount?: number): Promise<void> {
      // TV passes `amount` for a partial close (right-click → close partial /
      // the close-qty stepper). Forward it as `lots` so the partial path runs.
      const serverId = resolveServerId(positionId);
      if (!serverId) {
        _host?.showNotification?.('Close Failed', 'Position is still being registered — try again in a moment.', 0);
        throw new Error('no server id');
      }
      try {
        const body: Record<string, unknown> = {};
        const isPartial = typeof amount === 'number' && amount > 0;
        if (isPartial) body.lots = amount;
        const res = await api.post<{ profit?: number; close_price?: number; remaining_lots?: number }>(
          `/positions/${serverId}/close`, body,
        );
        if (isPartial && typeof res.remaining_lots === 'number' && res.remaining_lots > 0) {
          _host?.positionUpdate?.({ id: positionId, qty: res.remaining_lots });
          const pnl = res.profit ?? 0;
          const sign = pnl >= 0 ? '+' : '';
          _host?.showNotification?.('Partial Close', `Booked ${sign}$${pnl.toFixed(2)} — ${res.remaining_lots} lots remain`, 1);
        } else {
          _host?.positionUpdate?.({ id: positionId, qty: 0 });
        }
        await useTradingStore.getState().refreshPositions().catch(() => {});
        _host?.positionsFullUpdate?.();
        _host?.ordersFullUpdate?.();
      } catch (e: unknown) {
        _host?.showNotification?.('Close Failed', (e as { message?: string })?.message || 'Failed', 0);
        throw e;
      }
    },

    async reversePosition(): Promise<void> {
      /* not supported */
    },

    /* ─── Tradability / config ─── */
    isTradable(): Promise<boolean> {
      return Promise.resolve(true);
    },
    chartContextMenuActions(): Promise<unknown[]> {
      return Promise.resolve([]);
    },
    brokerConfig() {
      return BROKER_CONFIG;
    },
    quantityFormatter() {
      return {
        format: (qty: number) => qty.toFixed(2),
        parse: (str: string) => parseFloat(str) || 0.01,
      };
    },
  };
}

/** Broker config flags — also passed to the widget as `broker_config`. */
export const BROKER_CONFIG = {
  configFlags: {
    supportOrderBrackets: false,
    supportPositionBrackets: true, // ← draggable SL/TP on the position line
    supportClosePosition: true,
    supportPartialClosePosition: true,
    supportReversePosition: false,
    supportNativeReversePosition: false,
    supportMarketOrders: true,
    supportLimitOrders: true,
    supportStopOrders: true,
    supportStopLimitOrders: false,
    supportModifyOrder: true,
    supportCancelOrder: true,
    supportEditAmount: true,
    showQuantityInsteadOfAmount: true,
    supportLevel2Data: false,
    showNotificationsLog: true,
    supportPLUpdate: true, // live P&L pill on the entry line
    supportPositionNetting: false,
    positionPLInInstrumentCurrency: false,
  },
  durations: [],
};
