'use client';

/**
 * AI Strategies hub — every strategy the user owns as a card grid, plus two
 * secondary sections: Live Instances (deployed runners) and AI Trades. The
 * maker lives at /ai-strategies/new and each strategy at /ai-strategies/[id].
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, Bot, LineChart, Sparkles } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import InstancesTab from '@/components/ai-strategies/InstancesTab';
import AiTradesTab from '@/components/ai-strategies/AiTradesTab';
import {
  CollapsibleSection,
  EmptyState,
  PageHeader,
  Spinner,
  StatusPill,
} from '@/components/ai-strategies/shared';
import { formatDate } from '@/lib/formatters';
import { aiApi, type AiStrategySummary } from '@/lib/ai-strategies';

function StrategyCard({ strategy }: { strategy: AiStrategySummary }) {
  return (
    // `relative` + stretched link: the whole card is the click target while
    // middle-click / ctrl-click / keyboard focus keep working.
    <div className="relative flex flex-col bg-card border border-border-primary rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-colors hover:border-accent/30">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/ai-strategies/${strategy.id}`}
          className="min-w-0 text-sm font-semibold text-text-primary truncate hover:underline after:absolute after:inset-0 after:content-['']"
        >
          {strategy.name}
        </Link>
        <StatusPill status={strategy.status} />
      </div>

      <p className="text-[11px] font-mono font-bold text-text-secondary mt-1">
        {strategy.symbol} · <span className="uppercase">{strategy.timeframe}</span>
      </p>

      {strategy.description && (
        <p className="text-[11px] text-text-tertiary mt-2 line-clamp-2 leading-relaxed">
          {strategy.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border-primary text-[10px] text-text-tertiary">
        <span>Updated {formatDate(strategy.updated_at)}</span>
        {strategy.running_instances > 0 && (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {strategy.running_instances} running
          </span>
        )}
      </div>
    </div>
  );
}

export default function AiStrategiesPage() {
  const [strategies, setStrategies] = useState<AiStrategySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await aiApi.list();
      setStrategies(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Failed to load strategies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const runningTotal = strategies.reduce((s, x) => s + (x.running_instances || 0), 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="AI Strategies"
          description="Build trading strategies with AI, backtest them, and run them live on your accounts."
          actions={
            <Link
              href="/ai-strategies/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-bold transition-colors"
            >
              <Sparkles size={14} /> New strategy
            </Link>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : listError ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} /> {listError}
            </div>
            <button
              type="button"
              onClick={() => void fetchList()}
              className="text-xs px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : strategies.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No strategies yet"
            description="Describe a strategy in plain language and the AI Strategy Maker will turn it into rules you can backtest and deploy."
            action={
              <Link
                href="/ai-strategies/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-bold transition-colors"
              >
                <Sparkles size={14} /> Create your first strategy
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((s) => (
              <StrategyCard key={s.id} strategy={s} />
            ))}
          </div>
        )}

        {/* Secondary sections — content only mounts (and polls) while open.
            Rendered after the list loads so `defaultOpen` sees the final
            running count (useState captures it once on mount). */}
        {!loading && (
          <>
            <CollapsibleSection
              title="Live Instances"
              subtitle={runningTotal > 0 ? `${runningTotal} running` : undefined}
              icon={Activity}
              defaultOpen={runningTotal > 0}
            >
              <InstancesTab />
            </CollapsibleSection>

            <CollapsibleSection title="AI Trades" icon={LineChart}>
              <AiTradesTab />
            </CollapsibleSection>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
