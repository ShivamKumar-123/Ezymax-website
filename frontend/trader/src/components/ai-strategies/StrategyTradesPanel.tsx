'use client';

/**
 * Trades for ONE strategy on the detail page. The trades endpoints return
 * every AI trade for the user, so rows are filtered client-side by
 * `strategy_name`. Open rows are overlaid with live tradingStore positions so
 * P&L ticks in real time; when the strategy has no real fills yet but a
 * backtest exists, the simulated fills are shown clearly labelled as such.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { History, LineChart, TrendingUp } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { netPnl } from '@/lib/pnl';
import { formatDateTime, formatNumber } from '@/lib/formatters';
import { EmptyState } from '@/components/ai-strategies/shared';
import { BacktestTradesTable } from '@/components/ai-strategies/BacktestPanel';
import { aiApi, type AiClosedTrade, type BacktestTrade } from '@/lib/ai-strategies';

export interface OpenTradeRow {
  position_id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price?: number;
  profit?: number;
}

/** Open + closed AI trades for one strategy; open list polls every 10s. */
export function useStrategyTrades(strategyName: string | null) {
  const positions = useTradingStore((s) => s.positions);
  const [rawOpen, setRawOpen] = useState<OpenTradeRow[]>([]);
  const [closed, setClosed] = useState<AiClosedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!strategyName) return;
      if (!opts.silent) setLoading(true);
      try {
        const [open, hist] = await Promise.all([aiApi.openTrades(), aiApi.closedTrades()]);
        setRawOpen(
          (Array.isArray(open) ? open : []).filter((t) => t.strategy_name === strategyName),
        );
        setClosed(
          (Array.isArray(hist) ? hist : []).filter((t) => t.strategy_name === strategyName),
        );
      } catch {
        // keep last-known state
      } finally {
        if (!opts.silent) setLoading(false);
      }
    },
    [strategyName],
  );

  useEffect(() => {
    void fetchAll();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchAll({ silent: true });
    }, 10_000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // Overlay live store positions so open P&L ticks in real time.
  const open = useMemo<OpenTradeRow[]>(() => {
    const byId = new Map(positions.map((p) => [p.id, p] as const));
    return rawOpen.map((t) => {
      const live = byId.get(t.position_id);
      return live
        ? {
            ...t,
            symbol: live.symbol,
            side: live.side,
            lots: live.lots,
            open_price: live.open_price,
            current_price: live.current_price,
            profit: netPnl(live),
          }
        : t;
    });
  }, [rawOpen, positions]);

  const realizedPnl = useMemo(() => closed.reduce((s, t) => s + (t.profit || 0), 0), [closed]);

  return { open, closed, loading, realizedPnl };
}

function Pnl({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-text-tertiary">—</span>;
  return (
    <span className={clsx('font-mono font-bold tabular-nums', value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
      {value >= 0 ? '+' : '-'}${formatNumber(Math.abs(value))}
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  const isBuy = String(side).toLowerCase() === 'buy';
  return (
    <span className={clsx('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', isBuy ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell')}>
      {side}
    </span>
  );
}

interface StrategyTradesPanelProps {
  open: OpenTradeRow[];
  closed: AiClosedTrade[];
  /** Simulated fills from a backtest run this session (server keeps only stats). */
  simulatedTrades?: BacktestTrade[];
  hasBacktest: boolean;
}

export default function StrategyTradesPanel({
  open,
  closed,
  simulatedTrades,
  hasBacktest,
}: StrategyTradesPanelProps) {
  if (open.length === 0 && closed.length === 0) {
    if (!hasBacktest) {
      return (
        <EmptyState
          icon={TrendingUp}
          title="No trades yet"
          description="Once this strategy is deployed and takes a position, its fills appear here."
        />
      );
    }
    // The header metrics come from the backtest, so an empty table here would
    // read as a contradiction — show the simulated fills, clearly labelled.
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-bg-secondary border border-border-primary text-xs text-text-secondary">
          <History size={14} className="text-[#E94E1B] shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-text-primary">Simulated fills.</span> The numbers
            above come from a backtest — no money moved. Deploy the strategy to record real fills
            here.
          </p>
        </div>
        {simulatedTrades && simulatedTrades.length > 0 ? (
          <BacktestTradesTable trades={simulatedTrades} />
        ) : (
          <p className="text-[11px] text-text-tertiary">
            Run a backtest in this session to see the individual simulated fills.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {open.length > 0 && (
        <div className="rounded-xl border border-border-primary bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-primary">
            <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <LineChart size={14} className="text-[#E94E1B]" /> Open trades
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-border-primary text-text-tertiary text-left">
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 font-medium">Side</th>
                  <th className="px-4 py-2.5 font-medium text-right">Lots</th>
                  <th className="px-4 py-2.5 font-medium text-right">Open</th>
                  <th className="px-4 py-2.5 font-medium text-right">Current</th>
                  <th className="px-4 py-2.5 font-medium text-right pr-4">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {open.map((r) => (
                  <tr key={r.position_id} className="border-b border-border-primary last:border-0 hover:bg-bg-hover">
                    <td className="px-4 py-3 font-bold font-mono text-text-primary">{r.symbol}</td>
                    <td className="px-4 py-3"><SideBadge side={r.side} /></td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{r.lots}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{r.open_price}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{r.current_price ?? '—'}</td>
                    <td className="px-4 py-3 text-right pr-4"><Pnl value={r.profit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div className="rounded-xl border border-border-primary bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-primary">
            <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <History size={14} className="text-[#E94E1B]" /> Closed trades
            </p>
          </div>
          <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
            <table className="w-full min-w-[700px] text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border-primary text-text-tertiary text-left">
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 font-medium">Side</th>
                  <th className="px-4 py-2.5 font-medium text-right">Lots</th>
                  <th className="px-4 py-2.5 font-medium text-right">Open</th>
                  <th className="px-4 py-2.5 font-medium text-right">Close</th>
                  <th className="px-4 py-2.5 font-medium text-right">P&amp;L</th>
                  <th className="px-4 py-2.5 font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((t) => (
                  <tr key={t.position_id} className="border-b border-border-primary last:border-0 hover:bg-bg-hover">
                    <td className="px-4 py-3 font-bold font-mono text-text-primary">{t.symbol}</td>
                    <td className="px-4 py-3"><SideBadge side={t.side} /></td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{t.lots}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{t.open_price}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">{t.close_price}</td>
                    <td className="px-4 py-3 text-right"><Pnl value={t.profit} /></td>
                    <td className="px-4 py-3 text-text-tertiary whitespace-nowrap">{formatDateTime(t.closed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
