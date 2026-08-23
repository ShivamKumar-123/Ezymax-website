'use client';

/**
 * My Strategies — every strategy the user built in the AI Strategy Maker,
 * as cards with live status + latest backtest ROI, and the actions that
 * matter: Backtest · Deploy / Pause · Rename · Edit · Delete. Secondary
 * sections: Live Instances (deployed runners) and AI Trades.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import {
  Activity, AlertCircle, Bot, LineChart, Sparkles, Play, Pause, FlaskConical,
  Pencil, Trash2, SlidersHorizontal, TrendingUp, TrendingDown, Loader2, X,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import InstancesTab from '@/components/ai-strategies/InstancesTab';
import AiTradesTab from '@/components/ai-strategies/AiTradesTab';
import BacktestDialog from '@/components/ai-strategies/BacktestDialog';
import DeployDialog from '@/components/ai-strategies/DeployDialog';
import { CollapsibleSection, EmptyState, PageHeader, Spinner } from '@/components/ai-strategies/shared';
import Pagination, { usePagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/formatters';
import { aiApi, type AiInstance, type AiStrategySummary } from '@/lib/ai-strategies';

function ActionBtn({
  icon: Icon, label, onClick, tone = 'neutral', disabled, title,
}: {
  icon: typeof Play; label: string; onClick?: () => void; tone?: 'neutral' | 'primary' | 'danger'; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        tone === 'primary' && 'bg-crx-charcoal text-crx-charcoal-ink hover:bg-crx-charcoal-hover',
        tone === 'neutral' && 'bg-bg-card-nested text-text-primary hover:bg-bg-hover',
        tone === 'danger' && 'bg-bg-card-nested text-red-500 hover:bg-red-500/10',
      )}
    >
      <Icon size={12} strokeWidth={2} /> {label}
    </button>
  );
}

function StrategyCard({
  strategy, running, onBacktest, onDeploy, onPause, onRename, onDelete,
}: {
  strategy: AiStrategySummary;
  running: AiInstance[];
  onBacktest: () => void;
  onDeploy: () => void;
  onPause: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const roi = strategy.latest_return_pct;
  const hasBacktest = roi != null && Number.isFinite(Number(roi));
  const isRunning = running.length > 0;
  const up = (roi ?? 0) >= 0;
  return (
    <div className="relative flex flex-col rounded-[24px] p-5" style={{ background: 'var(--bg-card)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/ai-strategies/${strategy.id}`} className="block truncate text-base font-bold text-text-primary hover:underline">
            {strategy.name}
          </Link>
          <p className="mt-0.5 text-[11px] font-mono font-semibold text-text-secondary">
            {strategy.symbol} · <span className="uppercase">{strategy.timeframe}</span>
          </p>
        </div>
        <span
          className={clsx(
            'shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
            isRunning ? 'bg-emerald-500/15 text-emerald-500' : hasBacktest ? 'bg-crx-yellow-soft text-[#C73E11]' : 'bg-bg-card-nested text-text-secondary',
          )}
        >
          <span className={clsx('h-1.5 w-1.5 rounded-full', isRunning ? 'bg-emerald-500 animate-pulse' : hasBacktest ? 'bg-[#E94E1B]' : 'bg-text-tertiary')} />
          {isRunning ? `Live · ${running.length}` : hasBacktest ? 'Backtested' : 'Draft'}
        </span>
      </div>

      {/* ROI row */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">ROI</p>
          <p className={clsx('mt-0.5 flex items-center gap-1 text-lg font-semibold tabular-nums', !hasBacktest ? 'text-text-tertiary' : up ? 'text-emerald-500' : 'text-red-500')}>
            {hasBacktest ? <>{up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{up ? '+' : ''}{Number(roi).toFixed(1)}%</> : '—'}
          </p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Win rate</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">
            {strategy.latest_win_rate != null ? `${Number(strategy.latest_win_rate).toFixed(0)}%` : '—'}
          </p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'var(--bg-card-nested)' }}>
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Trades</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">{strategy.latest_total_trades ?? '—'}</p>
        </div>
      </div>

      {strategy.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-tertiary">{strategy.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <ActionBtn icon={FlaskConical} label="Backtest" onClick={onBacktest} tone="primary" />
        {isRunning ? (
          <ActionBtn icon={Pause} label="Pause" onClick={onPause} />
        ) : (
          <ActionBtn icon={Play} label="Deploy" onClick={onDeploy} disabled={!hasBacktest} title={!hasBacktest ? 'Run a backtest first' : undefined} />
        )}
        <Link href={`/ai-strategies/${strategy.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-bg-card-nested px-3 py-1.5 text-[11px] font-semibold text-text-primary hover:bg-bg-hover transition-colors">
          <SlidersHorizontal size={12} strokeWidth={2} /> Edit conditions
        </Link>
        <ActionBtn icon={Pencil} label="Rename" onClick={onRename} />
        <ActionBtn icon={Trash2} label="Delete" onClick={onDelete} tone="danger" disabled={isRunning} title={isRunning ? 'Pause the strategy before deleting' : undefined} />
      </div>

      <p className="mt-3 text-[10px] text-text-tertiary">
        Updated {formatDate(strategy.updated_at)}
        {strategy.latest_backtest_at ? ` · last backtest ${formatDate(strategy.latest_backtest_at)}` : ''}
      </p>
    </div>
  );
}

function RenameDialog({ open, initial, busy, onClose, onSave }: { open: boolean; initial: string; busy: boolean; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  useEffect(() => { setV(initial); }, [initial, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[24px] p-5" style={{ background: 'var(--bg-card)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Rename strategy</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-text-tertiary hover:bg-bg-hover"><X size={16} /></button>
        </div>
        <input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) onSave(v.trim()); }}
          className="mt-4 w-full rounded-xl border border-border-secondary bg-bg-card-nested px-3 py-2.5 text-sm text-text-primary focus:border-[#E94E1B]/50 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-hover">Cancel</button>
          <button type="button" disabled={busy || !v.trim()} onClick={() => onSave(v.trim())} className="inline-flex items-center gap-1.5 rounded-full bg-crx-charcoal px-4 py-2 text-xs font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AiStrategiesPage() {
  const [strategies, setStrategies] = useState<AiStrategySummary[]>([]);
  const [instances, setInstances] = useState<AiInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [backtestFor, setBacktestFor] = useState<AiStrategySummary | null>(null);
  const [deployFor, setDeployFor] = useState<AiStrategySummary | null>(null);
  const [renameFor, setRenameFor] = useState<AiStrategySummary | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchList = useCallback(async () => {
    setListError(null);
    try {
      const [res, inst] = await Promise.all([aiApi.list(), aiApi.instances().catch(() => [] as AiInstance[])]);
      setStrategies(Array.isArray(res) ? res : []);
      setInstances(Array.isArray(inst) ? inst : []);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'Failed to load strategies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchList(); }, [fetchList]);

  const runningByStrategy = useMemo(() => {
    const m = new Map<string, AiInstance[]>();
    for (const i of instances) if (i.status === 'running') m.set(i.strategy_id, [...(m.get(i.strategy_id) ?? []), i]);
    return m;
  }, [instances]);

  const pause = async (s: AiStrategySummary) => {
    const running = runningByStrategy.get(s.id) ?? [];
    if (running.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(running.map((i) => aiApi.stopInstance(i.id)));
      toast.success(`${s.name} paused`);
      await fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not pause');
    } finally { setBusy(false); }
  };

  const remove = async (s: AiStrategySummary) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await aiApi.remove(s.id);
      toast.success(r?.message || 'Strategy deleted');
      await fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    } finally { setBusy(false); }
  };

  const rename = async (v: string) => {
    if (!renameFor) return;
    setBusy(true);
    try {
      await aiApi.update(renameFor.id, { name: v });
      toast.success('Renamed');
      setRenameFor(null);
      await fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not rename');
    } finally { setBusy(false); }
  };

  const runningTotal = strategies.reduce((acc, x) => acc + (x.running_instances || 0), 0);
  const pager = usePagination(strategies, 6);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title="My Strategies"
          description="Everything you built with the AI Strategy Maker — backtest, deploy to any account, watch ROI, pause or refine."
          actions={
            <Link href="/ai-strategies/new" className="inline-flex items-center gap-2 rounded-full bg-[#E94E1B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#C73E11] transition-colors">
              <Sparkles size={14} /> Build with AI
            </Link>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner /></div>
        ) : listError ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <div className="flex items-center gap-2"><AlertCircle size={14} /> {listError}</div>
            <button type="button" onClick={() => void fetchList()} className="rounded-full border border-red-500/30 px-3 py-1 text-xs hover:bg-red-500/10">Retry</button>
          </div>
        ) : strategies.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No strategies yet"
            description="Describe a strategy in plain language and the AI Strategy Maker turns it into rules you can backtest and deploy."
            action={
              <Link href="/ai-strategies/new" className="inline-flex items-center gap-2 rounded-full bg-[#E94E1B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#C73E11] transition-colors">
                <Sparkles size={14} /> Create your first strategy
              </Link>
            }
          />
        ) : (
          <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pager.items.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                running={runningByStrategy.get(s.id) ?? []}
                onBacktest={() => setBacktestFor(s)}
                onDeploy={() => setDeployFor(s)}
                onPause={() => void pause(s)}
                onRename={() => setRenameFor(s)}
                onDelete={() => void remove(s)}
              />
            ))}
          </div>
          <Pagination {...pager.props} pageSizes={[6, 12, 24]} itemLabel="strategies" />
          </>
        )}

        {!loading && (
          <>
            <CollapsibleSection title="Live Instances" subtitle={runningTotal > 0 ? `${runningTotal} running` : undefined} icon={Activity} defaultOpen={runningTotal > 0}>
              <InstancesTab />
            </CollapsibleSection>
            <CollapsibleSection title="AI Trades" icon={LineChart}>
              <AiTradesTab />
            </CollapsibleSection>
          </>
        )}
      </div>

      {backtestFor && (
        <BacktestDialog
          open
          strategyId={backtestFor.id}
          onClose={() => setBacktestFor(null)}
          onCompleted={() => { setBacktestFor(null); toast.success('Backtest complete'); void fetchList(); }}
        />
      )}
      {deployFor && (
        <DeployDialog
          open
          strategyId={deployFor.id}
          strategyName={deployFor.name}
          onClose={() => setDeployFor(null)}
          onDeployed={() => { setDeployFor(null); toast.success(`${deployFor.name} deployed`); void fetchList(); }}
        />
      )}
      <RenameDialog open={!!renameFor} initial={renameFor?.name ?? ''} busy={busy} onClose={() => setRenameFor(null)} onSave={(v) => void rename(v)} />
    </DashboardShell>
  );
}
