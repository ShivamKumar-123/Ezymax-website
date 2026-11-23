/**
 * TradingView Trading Terminal Broker Adapter.
 *
 * Connects TradingView's built-in order panel to our trading API.
 * Implements IBrokerTerminal: placeOrder, modifyOrder, cancelOrder,
 * orders(), positions(), accountManagerInfo(), etc.
 */
import { useTradingStore } from '@/stores/tradingStore';
import api from '@/lib/api/client';

/* ─── TV Enums (mirrored from charting_library.d.ts) ─── */
const OrderSide = { Buy: 1, Sell: -1 } as const;
const OrderType = { Market: 1, Limit: 2, Stop: 3, StopLimit: 4 } as const;
const OrderStatus = { Canceled: 1, Filled: 2, Inactive: 3, Placing: 4, Rejected: 5, Working: 6 } as const;
const ParentType = { Order: 1, Position: 2 } as const;
const ConnectionStatus = { Connected: 1, Connecting: 2, Disconnected: 3, Error: 4 } as const;

let _host: any = null;
let _currentAccountId = '';
// The 1s host-update poller. Module-level so a re-created broker (chart
// remount, symbol/account switch) clears the previous timer instead of
// stacking a new one each time — the old code leaked one interval per
// terminal (re)mount for the lifetime of the tab.
let _pollTimer: ReturnType<typeof setInterval> | null = null;

/** Stop the broker's host-update poller. Call from the chart's cleanup. */
export function disposeBroker() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = null;
  _host = null;
}

function getActiveAccount() {
  return useTradingStore.getState().activeAccount;
}

function getPositions() {
  return useTradingStore.getState().positions;
}

function getPrices() {
  return useTradingStore.getState().prices;
}

export function createBroker(host: any): any {
  _host = host;
  const acc = getActiveAccount();
  _currentAccountId = acc?.id || '';

  // Push live updates to TV's broker host. The chart renders three things
  // off the data we push here:
  //   1) Position entry-price line — from positionUpdate(...)
  //   2) Live P&L pill on the entry line — from plUpdate(positionId, pl)
  //   3) SL / TP dashed lines with "SL | 0.01 Lots" pills — from the
  //      bracket child orders returned by orders() (see below). They
  //      auto-redraw whenever orderUpdate or ordersFullUpdate is called.
  // Polling at 1s gives a smooth P&L badge without hammering the API
  // (positions / prices are already in the local store from the WS feed).
  //
  // Critical: when the position SET changes (new position opened, one
  // closed), positionUpdate() alone won't make TV pick up the new id —
  // it only refreshes positions it already knows about. We have to call
  // positionsFullUpdate() + ordersFullUpdate() on transition so TV
  // re-calls positions() / orders() and renders the new entry / SL / TP
  // lines on the chart. Tracking by id-set diff so the full update only
  // fires on real change, not every tick.
  const prevPosIds = new Set<string>();
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(() => {
    try {
      if (!getActiveAccount()) return;
      const positions = getPositions();
      const prices = getPrices();

      const curIds = new Set(positions.map((p) => p.id));
      const changed =
        curIds.size !== prevPosIds.size ||
        positions.some((p) => !prevPosIds.has(p.id));
      if (changed) {
        prevPosIds.clear();
        for (const id of curIds) prevPosIds.add(id);
        _host?.positionsFullUpdate?.();
        _host?.ordersFullUpdate?.();
      }

      for (const pos of positions) {
        const tick = prices[pos.symbol];
        const cp = tick ? (pos.side === 'buy' ? tick.bid : tick.ask) : undefined;
        _host?.positionUpdate({
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
      if (a) {
        _host?.equityUpdate?.(a.equity ?? a.balance ?? 0);
      }
    } catch {}
  }, 1000);

  // ── Bracket-order encoding ────────────────────────────────────────────
  // TV draws the labelled SL/TP lines from child orders attached to a
  // position via parentId + parentType. We synthesise these on the fly
  // from each position's stop_loss / take_profit fields. IDs are stable
  // (`{posId}__sl` / `{posId}__tp`) so TV diffs them correctly between
  // orders() calls and only redraws when the price actually changes.
  const slId = (posId: string) => `${posId}__sl`;
  const tpId = (posId: string) => `${posId}__tp`;
  function buildBracketOrders(): any[] {
    const out: any[] = [];
    for (const p of getPositions()) {
      const oppSide = p.side === 'buy' ? OrderSide.Sell : OrderSide.Buy;
      if (p.stop_loss != null) {
        out.push({
          id: slId(p.id),
          parentId: p.id,
          parentType: ParentType.Position,
          symbol: p.symbol,
          type: OrderType.Stop,
          side: oppSide,
          qty: p.lots,
          stopPrice: p.stop_loss,
          status: OrderStatus.Working,
        });
      }
      if (p.take_profit != null) {
        out.push({
          id: tpId(p.id),
          parentId: p.id,
          parentType: ParentType.Position,
          symbol: p.symbol,
          type: OrderType.Limit,
          side: oppSide,
          qty: p.lots,
          limitPrice: p.take_profit,
          status: OrderStatus.Working,
        });
      }
    }
    return out;
  }
  function bracketParentAndKind(id: string): { posId: string; kind: 'sl' | 'tp' } | null {
    if (id.endsWith('__sl')) return { posId: id.slice(0, -4), kind: 'sl' };
    if (id.endsWith('__tp')) return { posId: id.slice(0, -4), kind: 'tp' };
    return null;
  }

  return {
    /* ─── Connection ─── */
    connectionStatus(): number {
      return ConnectionStatus.Connected;
    },

    /* ─── Account ─── */
    accountsMetainfo(): Promise<any[]> {
      const acc = getActiveAccount();
      if (!acc) return Promise.resolve([]);
      return Promise.resolve([{
        id: acc.id,
        name: `${acc.account_number} (${acc.is_demo ? 'Demo' : 'Live'})`,
        currency: acc.currency || 'USD',
      }]);
    },

    currentAccount(): string {
      return _currentAccountId || getActiveAccount()?.id || '';
    },

    setCurrentAccount(accountId: string) {
      _currentAccountId = accountId;
    },

    accountManagerInfo(): any {
      const acc = getActiveAccount();
      return {
        accountTitle: 'Trading',
        summary: [
          { text: 'Balance', wValue: acc?.balance ?? 0, formatter: 'fixed', isDefault: true },
          { text: 'Equity', wValue: acc?.equity ?? 0, formatter: 'fixed' },
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
    async orders(): Promise<any[]> {
      const acc = getActiveAccount();
      if (!acc) return buildBracketOrders();
      let pending: any[] = [];
      try {
        const res = await api.get<any>(`/orders/?account_id=${acc.id}&status=pending`);
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        pending = items.map((o: any) => ({
          id: o.id,
          symbol: o.symbol,
          side: o.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          type: o.order_type === 'limit' ? OrderType.Limit : o.order_type === 'stop' ? OrderType.Stop : OrderType.Market,
          qty: o.lots,
          limitPrice: o.price,
          stopPrice: o.stop_price,
          status: OrderStatus.Working,
          filledQty: 0,
        }));
      } catch {}
      // Bracket child orders are appended after the pending list. TV uses
      // parentId + parentType to identify them and renders them as SL/TP
      // lines on the chart instead of as standalone pending orders.
      return [...pending, ...buildBracketOrders()];
    },

    /* ─── Positions ─── */
    async positions(): Promise<any[]> {
      const positions = getPositions();
      const prices = getPrices();
      // SL/TP intentionally not on the Position object — TV ignores them
      // there for chart rendering. They surface as bracket child orders
      // via orders() (see buildBracketOrders) which is what the chart
      // layer actually uses to draw the labelled SL/TP lines.
      return positions.map((p) => {
        const tick = prices[p.symbol];
        const cp = tick ? (p.side === 'buy' ? tick.bid : tick.ask) : p.current_price || p.open_price;
        return {
          id: p.id,
          symbol: p.symbol,
          side: p.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
          qty: p.lots,
          avgPrice: p.open_price,
          pl: p.profit || 0,
          last: cp,
        };
      });
    },

    async executions(symbol: string): Promise<any[]> {
      // Returning fills here lets TV draw entry markers (triangle/circle)
      // on the candle where the position opened — so the trader can see
      // exactly when and at what price they entered, in addition to the
      // horizontal entry-price line that the position rendering provides.
      const positions = getPositions().filter((p) => p.symbol === symbol);
      return positions.map((p) => ({
        symbol: p.symbol,
        price: p.open_price,
        time: new Date(p.created_at || Date.now()).getTime(),
        side: p.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
        qty: p.lots,
      }));
    },

    /* ─── Trade Actions ─── */
    async placeOrder(order: any): Promise<any> {
      const acc = getActiveAccount();
      if (!acc) throw new Error('No active account');

      const sym = order.symbol?.includes(':') ? order.symbol.split(':').pop() : order.symbol;
      const side = order.side === OrderSide.Buy ? 'buy' : 'sell';
      const isMarket = order.type === OrderType.Market;

      const body: any = {
        account_id: acc.id,
        symbol: sym,
        side,
        order_type: isMarket ? 'market' : order.type === OrderType.Limit ? 'limit' : 'stop',
        lots: order.qty,
      };
      if (!isMarket && order.limitPrice) body.price = order.limitPrice;
      if (order.stopPrice) body.stop_price = order.stopPrice;
      if (order.stopLoss) body.stop_loss = order.stopLoss;
      if (order.takeProfit) body.take_profit = order.takeProfit;

      try {
        const res = await api.post<any>('/orders/', body);
        const orderId = res?.id || res?.order_id || `tv_${Date.now()}`;

        if (isMarket && res?.position_id) {
          // Market order filled immediately → show as position. avgPrice
          // must be the actual fill price (returned by the API), NOT
          // order.limitPrice (which is meaningless for a market order).
          // Wrong avgPrice produced incorrect entry-price lines on chart.
          const fillPx = res?.filled_price || res?.fill_price || res?.avg_price || res?.price || 0;
          _host?.orderUpdate({
            id: orderId,
            symbol: sym,
            side: order.side,
            type: OrderType.Market,
            qty: order.qty,
            status: OrderStatus.Filled,
            filledQty: order.qty,
            avgPrice: fillPx,
          });

          // Refresh positions, then nudge TV to re-fetch orders so the
          // SL/TP bracket lines render immediately on the new position
          // (otherwise they only appear on the next 1s poll tick).
          setTimeout(() => {
            useTradingStore.getState().refreshPositions().catch(() => {});
            _host?.ordersFullUpdate?.();
          }, 300);
        }

        return { orderId };
      } catch (e: any) {
        _host?.showNotification?.('Order Failed', e?.message || 'Could not place order', 0);
        throw e;
      }
    },

    async modifyOrder(order: any): Promise<void> {
      // Dragging a bracket SL/TP line on the chart routes through here.
      // Resolve back to the parent position and call editPositionBrackets
      // so we hit the position-modify endpoint instead of the order one
      // (the bracket orders we surface are synthetic — they don't exist
      // server-side as orders, only as fields on the position).
      const meta = bracketParentAndKind(order.id);
      if (meta) {
        const newPrice = meta.kind === 'sl' ? order.stopPrice : order.limitPrice;
        const positions = getPositions();
        const pos = positions.find((p) => p.id === meta.posId);
        const brackets: any = {
          stopLoss: meta.kind === 'sl' ? newPrice : pos?.stop_loss,
          takeProfit: meta.kind === 'tp' ? newPrice : pos?.take_profit,
        };
        return (this as any).editPositionBrackets(meta.posId, brackets);
      }

      try {
        const body: any = {};
        if (order.limitPrice != null) body.price = order.limitPrice;
        if (order.stopPrice != null) body.stop_price = order.stopPrice;
        if (order.qty != null) body.lots = order.qty;
        await api.put(`/orders/${order.id}`, body);
        _host?.orderUpdate({ ...order, status: OrderStatus.Working });
      } catch (e: any) {
        _host?.showNotification?.('Modify Failed', e?.message || 'Failed', 0);
        throw e;
      }
    },

    async cancelOrder(orderId: string): Promise<void> {
      // Removing an SL/TP line from the chart maps to clearing the
      // corresponding field on the parent position, not deleting an
      // order (synthetic bracket — has no server-side order row).
      const meta = bracketParentAndKind(orderId);
      if (meta) {
        const positions = getPositions();
        const pos = positions.find((p) => p.id === meta.posId);
        try {
          await api.put(`/positions/${meta.posId}`, {
            stop_loss: meta.kind === 'sl' ? null : pos?.stop_loss ?? null,
            take_profit: meta.kind === 'tp' ? null : pos?.take_profit ?? null,
          });
          _host?.orderUpdate({ id: orderId, status: OrderStatus.Canceled });
          await useTradingStore.getState().refreshPositions().catch(() => {});
          _host?.ordersFullUpdate?.();
        } catch (e: any) {
          _host?.showNotification?.('Cancel Failed', e?.message || 'Failed', 0);
          throw e;
        }
        return;
      }

      try {
        await api.delete(`/orders/${orderId}`);
        _host?.orderUpdate({ id: orderId, status: OrderStatus.Canceled });
      } catch (e: any) {
        _host?.showNotification?.('Cancel Failed', e?.message || 'Failed', 0);
        throw e;
      }
    },

    // Drag-edit / Edit-position dialog for SL/TP. TV calls this when:
    //   • user drags an SL or TP line on the chart
    //   • user opens the position context menu → Edit position…
    // After server confirms, refresh positions + ask TV to re-fetch
    // orders so the bracket lines redraw at the new prices.
    async editPositionBrackets(positionId: string, brackets: any): Promise<void> {
      try {
        await api.put(`/positions/${positionId}`, {
          stop_loss: brackets?.stopLoss ?? null,
          take_profit: brackets?.takeProfit ?? null,
        });
        await useTradingStore.getState().refreshPositions().catch(() => {});
        _host?.ordersFullUpdate?.();
      } catch (e: any) {
        _host?.showNotification?.('Modify Failed', e?.message || 'Failed', 0);
        throw e;
      }
    },

    async closePosition(positionId: string, amount?: number): Promise<void> {
      // TradingView passes `amount` when the user closes only part of a
      // position via the chart (right-click position → close partial, or
      // the inline close-quantity stepper). We have to forward it as
      // `lots` to the backend so the partial-close path runs and the
      // realized profit toast fires; ignoring it (the previous behaviour)
      // silently turned every partial close on the chart into a full
      // close and the "booking profit" the trader expected to see for
      // the partial slice was never surfaced.
      try {
        const body: Record<string, unknown> = {};
        const isPartial = typeof amount === 'number' && amount > 0;
        if (isPartial) body.lots = amount;
        const res = await api.post<{ profit?: number; close_price?: number; remaining_lots?: number }>(
          `/positions/${positionId}/close`,
          body,
        );
        if (isPartial && typeof res.remaining_lots === 'number' && res.remaining_lots > 0) {
          _host?.positionUpdate({ id: positionId, qty: res.remaining_lots });
          const pnl = res.profit ?? 0;
          const sign = pnl >= 0 ? '+' : '';
          _host?.showNotification?.(
            'Partial Close',
            `Booked ${sign}$${pnl.toFixed(2)} — ${res.remaining_lots} lots remain`,
            1,
          );
        } else {
          _host?.positionUpdate({ id: positionId, qty: 0 });
        }
      } catch (e: any) {
        _host?.showNotification?.('Close Failed', e?.message || 'Failed', 0);
        throw e;
      }
    },

    async reversePosition(positionId: string): Promise<void> {
      // Not supported
    },

    /* ─── Tradability ─── */
    isTradable(symbol: string): Promise<boolean> {
      return Promise.resolve(true);
    },

    chartContextMenuActions(): Promise<any[]> {
      return Promise.resolve([]);
    },

    /* ─── Config ─── */
    brokerConfig(): any {
      return {
        configFlags: {
          supportOrderBrackets: false,
          supportPositionBrackets: true,    // SL/TP attached to position
          supportClosePosition: true,
          // Enables TV's "close partial" UI affordances (the close
          // dialog gains a quantity field; right-click position menu
          // shows "Close partial"). Our closePosition handler forwards
          // the amount to the backend as `lots`.
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
          // Required for TV to render the entry / SL / TP horizontal lines
          // + execution markers on the chart. Without these flags TV
          // silently skips the draw even when positions() returns SL/TP.
          showNotificationsLog: true,
          supportPLUpdate: true,
          supportPositionNetting: false,
          positionPLInInstrumentCurrency: false,
        },
        durations: [],
      };
    },

    quantityFormatter(symbol: string) {
      return {
        format: (qty: number) => qty.toFixed(2),
        parse: (str: string) => parseFloat(str) || 0.01,
      };
    },
  };
}
