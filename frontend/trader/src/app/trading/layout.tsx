'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';
import { wsManager } from '@/lib/ws/wsManager';
import { extractTicksFromPayload } from '@/lib/ws/normalizePricePayload';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';
import { sounds, unlockAudio } from '@/lib/sounds';
import TopBar from '@/components/layout/TopBar';

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

  const {
    updatePrice,
    setActiveAccount,
    setAccounts,
    setPositions,
    setPendingOrders,
    setInstruments,
    refreshPositions,
    refreshAccount,
  } = useTradingStore();
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
      const ticks = extractTicksFromPayload(data);
      for (const t of ticks) updatePrice(t);
    });

    let pollCancelled = false;
    const pollPricesFromApi = async () => {
      try {
        const raw = await api.get<unknown>('/instruments/prices/all', undefined, { timeoutMs: 15000 });
        if (pollCancelled) return;
        for (const t of extractTicksFromPayload(raw)) updatePrice(t);
      } catch {
        /* ignore */
      }
    };
    void pollPricesFromApi();
    const pricePoll = setInterval(pollPricesFromApi, 1500);

    const positionPoll = setInterval(async () => {
      const before = useTradingStore.getState().positions;
      const beforeIds = new Set(before.map((p) => p.id));

      await refreshPositions();
      await refreshAccount();

      const after = useTradingStore.getState().positions;
      const afterIds = new Set(after.map((p) => p.id));

      if (beforeIds.size > 0) {
        beforeIds.forEach((id) => {
          if (!afterIds.has(id)) {
            const closed = before.find((p) => p.id === id);
            if (closed) {
              const pnl = closed.profit || 0;
              const hadSl = closed.stop_loss != null;
              const hadTp = closed.take_profit != null;
              const isLoss = pnl < 0;
              const reason =
                isLoss && hadSl
                  ? 'Stop Loss'
                  : !isLoss && hadTp
                    ? 'Take Profit'
                    : hadSl
                      ? 'Stop Loss'
                      : hadTp
                        ? 'Take Profit'
                        : 'Closed';
              const emoji = reason === 'Stop Loss' ? '🛑' : reason === 'Take Profit' ? '🎯' : '⚡';

              reason === 'Stop Loss' ? sounds.loss() : sounds.profit();

              toast.custom(
                (t) => (
                  <div
                    className={clsx(
                      'pointer-events-auto flex gap-3 rounded-xl border px-3.5 py-3 shadow-modal max-w-[min(92vw,360px)]',
                      'transition-opacity duration-200',
                      t.visible ? 'opacity-100' : 'opacity-0',
                    )}
                    style={{ background: '#111', borderColor: 'rgba(255,255,255,0.1)', color: '#f0f0f0' }}
                  >
                    <span className="text-xl shrink-0 leading-none pt-0.5 select-none" aria-hidden>
                      {emoji}
                    </span>
                    <div className="min-w-0 flex-1 text-[13px] leading-snug font-semibold">
                      <p style={{ color: '#f0f0f0' }}>
                        {reason} Hit — <span style={{ color: '#aaa' }}>{closed.symbol}</span>{' '}
                        <span className={closed.side === 'buy' ? 'text-buy' : 'text-sell'}>
                          {closed.side.toUpperCase()}
                        </span>{' '}
                        <span className="font-mono tabular-nums" style={{ color: '#aaa' }}>{closed.lots}</span> lots
                      </p>
                      <p
                        className={clsx(
                          'mt-1.5 text-sm font-bold font-mono tabular-nums',
                          pnl >= 0 ? 'text-buy' : 'text-sell',
                        )}
                      >
                        P&L: {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ),
                { duration: 6000 },
              );
            }
          }
        });
      }
    }, 3000);

    return () => {
      cancelled = true;
      pollCancelled = true;
      unsub();
      clearInterval(positionPoll);
      clearInterval(pricePoll);
    };
  }, [setAccounts, setInstruments, updatePrice, refreshPositions, refreshAccount]);

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

  return <>{children}</>;
}

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const terminalOnly = pathname?.startsWith('/trading/terminal');

  return (
    <div
      className={clsx(
        'trading-page flex flex-col h-[100dvh] bg-bg-base min-h-0',
        terminalOnly ? 'pb-0 md:pb-0' : 'pb-16 md:h-screen md:pb-0',
      )}
      data-theme="dark"
    >
      {!terminalOnly && <TopBar />}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm bg-bg-primary">
              Loading trading…
            </div>
          }
        >
          <TradingSession>{children}</TradingSession>
        </Suspense>
      </div>
    </div>
  );
}
