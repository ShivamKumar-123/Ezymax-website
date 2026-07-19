'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';
import { wsManager } from '@/lib/ws/wsManager';
import { tradeSocket } from '@/lib/ws/tradeSocket';
import { extractTicksFromPayload } from '@/lib/ws/normalizePricePayload';
import api from '@/lib/api/client';
import { sounds, unlockAudio } from '@/lib/sounds';
import DashboardShell from '@/components/layout/DashboardShell';

function mapApiAccount(a: Record<string, unknown>): TradingAccount {
  const g = a.account_group as Record<string, unknown> | null | undefined;
  return {
    id: String(a.id),
    account_number: String(a.account_number ?? ''),
    balance: Number(a.balance) || 0,
    credit: Number(a.credit) || 0,
    equity: Number(a.equity ?? a.balance) || 0,
    margin_used: Number(a.margin_used) || 0,
    free_margin: Number(a.free_margin ?? a.balance) || 0,
    margin_level: Number(a.margin_level) || 0,
    leverage: Number(a.leverage) || 100,
    currency: String(a.currency ?? 'USD'),
    is_demo: Boolean(a.is_demo),
    account_group: g
      ? {
          id: String(g.id),
          name: String(g.name ?? 'Account'),
          spread_markup: Number(g.spread_markup) || 0,
          commission_per_lot: Number(g.commission_per_lot) || 0,
          minimum_deposit: Number(g.minimum_deposit) || 0,
          swap_free: Boolean(g.swap_free),
          leverage_default: Number(g.leverage_default) || 100,
        }
      : null,
  };
}

function TradingSession({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const accountQueryId = searchParams.get('account');

  // Actions only — zustand action references are stable, so selecting them
  // individually means this shell component never re-renders on price ticks.
  const updatePrices = useTradingStore((s) => s.updatePrices);
  const setActiveAccount = useTradingStore((s) => s.setActiveAccount);
  const setAccounts = useTradingStore((s) => s.setAccounts);
  const setPositions = useTradingStore((s) => s.setPositions);
  const setPendingOrders = useTradingStore((s) => s.setPendingOrders);
  const setInstruments = useTradingStore((s) => s.setInstruments);
  const refreshPositions = useTradingStore((s) => s.refreshPositions);
  const refreshAccount = useTradingStore((s) => s.refreshAccount);
  const accounts = useTradingStore((s) => s.accounts);

  useEffect(() => {
    const onFirstGesture = () => {
      unlockAudio();
    };
    document.addEventListener('pointerdown', onFirstGesture, { passive: true });
    document.addEventListener('keydown', onFirstGesture);
    return () => {
      document.removeEventListener('pointerdown', onFirstGesture);
      document.removeEventListener('keydown', onFirstGesture);
    };
  }, []);

  /* Core data + WebSocket + polling (once). */
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [accountsRes, instrumentsRes] = await Promise.all([
          api.get<unknown>('/accounts').catch(() => ({ items: [] })),
          api.get<unknown>('/instruments/').catch(() => []),
        ]);

        if (cancelled) return;

        const instruments = Array.isArray(instrumentsRes)
          ? instrumentsRes
          : ((instrumentsRes as { items?: unknown[] })?.items ?? []);
        if (instruments.length > 0) {
          setInstruments(
            instruments.map((i: Record<string, unknown>) => ({
              symbol: String(i.symbol),
              display_name: String(i.display_name || i.symbol),
              segment: String((i.segment as { name?: string })?.name || i.segment || ''),
              digits: Number(i.digits ?? 5),
              pip_size: Number(i.pip_size ?? 0.0001),
              min_lot: Number(i.min_lot ?? 0.01),
              max_lot: Number(i.max_lot ?? 100),
              lot_step: Number(i.lot_step ?? 0.01),
              contract_size: Number(i.contract_size ?? 100000),
              base_currency: i.base_currency ? String(i.base_currency) : null,
              quote_currency: i.quote_currency ? String(i.quote_currency) : null,
            })),
          );
        }

        const rawList = Array.isArray(accountsRes)
          ? accountsRes
          : ((accountsRes as { items?: unknown[] })?.items ?? []);
        setAccounts((rawList as Record<string, unknown>[]).map(mapApiAccount));
      } catch (err) {
        console.error('Trading bootstrap failed:', err);
      }
    }

    void bootstrap();

    wsManager.connect();
    const unsub = wsManager.onMessage((data) => {
      // Batched: one store update (and one render pass) per WS payload,
      // regardless of how many symbols it carries.
      updatePrices(extractTicksFromPayload(data));
    });

    let pollCancelled = false;
    const pollPricesFromApi = async () => {
      // Skip network + store churn while the tab is hidden; the WS feed and
      // the immediate poll on the next visible tick catch the state back up.
      if (document.hidden) return;
      try {
        const raw = await api.get<unknown>('/instruments/prices/all', undefined, { timeoutMs: 15000 });
        if (pollCancelled) return;
        updatePrices(extractTicksFromPayload(raw));
      } catch {
        /* ignore */
      }
    };
    void pollPricesFromApi();
    const pricePoll = setInterval(pollPricesFromApi, 1500);

    // Background reconcile only — this poll must NOT play close sounds. It used
    // to diff before/after position ids and play a profit/loss sound for any id
    // that vanished, but that:
    //   • fired every 1.5s, so any transient flicker (a racing refresh re-adding
    //     then removing a just-closed row) looped the sound;
    //   • misfired on the optimistic→real id swap — a fresh trade's `optim-…`
    //     id "disappears" when promoted to its UUID, which the diff read as a
    //     close and played a phantom loss sound.
    // Close sounds now come ONCE from the event-driven sources: the trade WS
    // (SL/TP hit, stop-out) and the manual-close response (PositionsPanel) —
    // both instant, neither on a timer.
    const positionPoll = setInterval(async () => {
      if (document.hidden) return;
      await refreshPositions();
      await refreshAccount();
    }, 1500);

    // Returning to a hidden tab: reconcile immediately instead of waiting for
    // the next interval slot.
    const onVisible = () => {
      if (document.hidden) return;
      void pollPricesFromApi();
      void refreshPositions();
      void refreshAccount();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      pollCancelled = true;
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(positionPoll);
      clearInterval(pricePoll);
    };
  }, [setAccounts, setInstruments, updatePrices, refreshPositions, refreshAccount]);

  /* Picker vs terminal: active account + positions. */
  useEffect(() => {
    let cancelled = false;

    const onPicker = pathname === '/trading' || pathname === '/trading/';
    if (onPicker) {
      setActiveAccount(null);
      setPositions([]);
      setPendingOrders([]);
      return;
    }

    if (!pathname.startsWith('/trading/terminal')) {
      return;
    }

    if (!accountQueryId) {
      setActiveAccount(null);
      setPositions([]);
      setPendingOrders([]);
      return;
    }

    const acc = accounts.find((a) => a.id === accountQueryId);
    if (!acc) {
      return;
    }

    setActiveAccount(acc);

    (async () => {
      try {
        const [positions, orders] = await Promise.all([
          api.get<unknown[]>(`/positions/`, { account_id: acc.id, status: 'open' }).catch(() => []),
          api.get<unknown[]>(`/orders/`, { account_id: acc.id, status: 'pending' }).catch(() => []),
        ]);
        if (cancelled) return;

        const posList = Array.isArray(positions) ? positions : [];
        setPositions(
          posList.map((row) => {
            const p = row as Record<string, unknown>;
            return {
            id: String(p.id),
            account_id: String(p.account_id),
            symbol: String(p.symbol || (p.instrument as { symbol?: string })?.symbol || ''),
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
            created_at: String(p.created_at ?? ''),
            };
          }),
        );

        const ordList = Array.isArray(orders) ? orders : [];
        setPendingOrders(
          ordList.map((row) => {
            const o = row as Record<string, unknown>;
            return {
            id: String(o.id),
            account_id: String(o.account_id),
            symbol: String(o.symbol || (o.instrument as { symbol?: string })?.symbol || ''),
            order_type: String(o.order_type),
            side: o.side as 'buy' | 'sell',
            status: String(o.status),
            lots: Number(o.lots) || 0,
            price: Number(o.price) || 0,
            stop_loss: o.stop_loss != null ? Number(o.stop_loss) : undefined,
            take_profit: o.take_profit != null ? Number(o.take_profit) : undefined,
            created_at: String(o.created_at ?? ''),
            };
          }),
        );
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, accountQueryId, accounts, setActiveAccount, setPositions, setPendingOrders]);

  /* Trade-event WebSocket. Subscribes to /ws/trades/{accountId} which
   * forwards Redis pub/sub events from the SL/TP engine. Previously the
   * client polled positions every 1.5s and silently played a sound when a
   * row disappeared — the user never saw a toast for SL/TP fills, and the
   * Closed Positions tab only refreshed every 4s while it was active, so
   * the new row could take a full minute to surface. Now we react to
   * `position_closed` instantly: refresh open positions + account, fire a
   * toast naming the reason and P&L, and broadcast `trade:closed` so the
   * PositionsPanel can pull the new history row immediately. */
  useEffect(() => {
    if (!accountQueryId) return;
    tradeSocket.connect(accountQueryId);
    const unsub = tradeSocket.subscribe((evt) => {
      // Copy-trade open on a follower account: the copy engine opens the
      // position server-side, so pull it into the open-positions list live
      // instead of waiting for a manual refresh.
      if (evt.type === 'position_opened') {
        void refreshPositions();
        void refreshAccount();
        return;
      }
      // SL/TP edited on this account (possibly from another device / the chart)
      // — pull the new brackets so the chart lines and table update together.
      if (evt.type === 'position_updated') {
        void refreshPositions();
        return;
      }
      // A pending order filled (limit/stop triggered by the b-book engine):
      // the fill creates a position, so pull it in so its chart line + row
      // appear live, and refresh balance/margin.
      if (evt.type === 'order_filled') {
        void refreshPositions();
        void refreshAccount();
        return;
      }
      // Risk-engine stop-out closes a position but emits its OWN event type
      // (not position_closed), so without this the stopped-out position's chart
      // line would linger until a manual refresh. Treat it as a close: drop the
      // position so syncLines removes the line live, then refresh + notify.
      if (evt.type === 'stop_out') {
        const soId = String(evt.position_id ?? '');
        const soSym = useTradingStore.getState().positions.find((p) => p.id === soId)?.symbol ?? '';
        if (soId) useTradingStore.getState().removePosition(soId);
        void refreshPositions();
        void refreshAccount();
        const soPnl = Number(evt.profit ?? 0);
        toast.error(`Stop-out${soSym ? ` · ${soSym}` : ''}\nP&L: ${soPnl >= 0 ? '+' : '-'}$${Math.abs(soPnl).toFixed(2)}`, { duration: 5000 });
        sounds.loss();
        return;
      }
      // Balance changed with no position event (deposit credited, withdrawal
      // approved) — refresh the account header numbers.
      if (evt.type === 'deposit' || evt.type === 'withdrawal') {
        void refreshAccount();
        return;
      }
      if (evt.type !== 'position_closed') return;

      const reason = String(evt.reason ?? '');
      const positionId = String(evt.position_id ?? '');
      const rawProfit = Number(evt.profit ?? 0);
      const profit = Number.isFinite(rawProfit) ? rawProfit : 0;

      const closed = useTradingStore.getState().positions.find((p) => p.id === positionId);
      const symbol = closed?.symbol ?? '';

      if (positionId) useTradingStore.getState().removePosition(positionId);
      void refreshPositions();
      void refreshAccount();
      window.dispatchEvent(new CustomEvent('trade:closed', { detail: { positionId, reason, profit, symbol } }));

      if (reason === 'sl' || reason === 'tp') {
        const label = reason === 'tp' ? 'Take Profit' : 'Stop Loss';
        const pnlStr = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;
        const title = symbol ? `${label} hit · ${symbol}` : `${label} hit`;
        if (reason === 'tp') {
          toast.success(`${title}\nP&L: ${pnlStr}`, { duration: 5000 });
          sounds.profit();
        } else {
          toast.error(`${title}\nP&L: ${pnlStr}`, { duration: 5000 });
          sounds.loss();
        }
      }
    });

    return () => {
      unsub();
      tradeSocket.disconnect();
    };
  }, [accountQueryId, refreshPositions, refreshAccount]);

  return <>{children}</>;
}

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const terminalOnly = pathname?.startsWith('/trading/terminal');

  const fallback = (
    <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm bg-bg-primary">
      Loading trading…
    </div>
  );

  if (terminalOnly) {
    // Light-only application — dark theme has been retired (no toggle, no
    // uiStore.theme read here) so a stale persisted value can never flip the
    // terminal back to dark.
    return (
      <div
        className="trading-page theme-light flex flex-col h-[100dvh] bg-bg-base min-h-0"
        data-theme="light"
      >
        <div className="flex-1 flex overflow-hidden min-h-0">
          <Suspense fallback={fallback}>
            <TradingSession>{children}</TradingSession>
          </Suspense>
        </div>
      </div>
    );
  }

  /* Account picker (/trading) uses the standard app chrome — the new
   * AppNavbar + the user's theme — so it matches the rest of the
   * logged-in app instead of the old dark TopBar. */
  return (
    <Suspense fallback={fallback}>
      <TradingSession>
        <DashboardShell>{children}</DashboardShell>
      </TradingSession>
    </Suspense>
  );
}
