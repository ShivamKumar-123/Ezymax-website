'use client';

/**
 * AI Strategy detail — header actions (Backtest / Delete / Deploy or Stop),
 * badge row, metric tiles from the latest backtest, and four tabs:
 * Overview · Configuration · Trades · Backtest history.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowLeft,
  History,
  Rocket,
  Square,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import Modal from '@/components/ui/Modal';
import Tabs from '@/components/ui/Tabs';
import RuleCard from '@/components/ai-strategies/RuleCard';
import { EquityCurve } from '@/components/ai-strategies/BacktestPanel';
import BacktestDialog, { type BacktestRun } from '@/components/ai-strategies/BacktestDialog';
import DeployDialog from '@/components/ai-strategies/DeployDialog';
import StrategyTradesPanel, {
  useStrategyTrades,
} from '@/components/ai-strategies/StrategyTradesPanel';
import {
  EmptyState,
  MetricTile,
  PageHeader,
  Spinner,
  StatusPill,
  inputCls,
} from '@/components/ai-strategies/shared';
import {
  formatCurrencySigned,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPct,
} from '@/lib/formatters';
import {
  aiApi,
  type AiInstance,
  type AiStrategyDetail,
  type BacktestStats,
  type StrategyDsl,
} from '@/lib/ai-strategies';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'config', label: 'Configuration' },
  { id: 'trades', label: 'Trades' },
  { id: 'history', label: 'Backtest history' },
];

function StatsTiles({ stats }: { stats: BacktestStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      <MetricTile
        label="Return"
        value={formatPct(stats.return_pct)}
        tone={stats.return_pct >= 0 ? 'profit' : 'loss'}
      />
      <MetricTile label="Max drawdown" value={`−${formatNumber(stats.max_drawdown_pct)}%`} tone="loss" />
      <MetricTile
        label="Net profit"
        value={formatCurrencySigned(stats.net_profit)}
        tone={stats.net_profit >= 0 ? 'profit' : 'loss'}
      />
      <MetricTile label="Win rate" value={`${formatNumber(stats.win_rate, 1)}%`} />
      <MetricTile
        label="Profit factor"
        value={Number.isFinite(stats.profit_factor) ? formatNumber(stats.profit_factor) : '∞'}
      />
      <MetricTile label="Trades" value={`${stats.total_trades} (${stats.wins}W / ${stats.losses}L)`} />
    </div>
  );
}

function HistoryRow({
  label,
  when,
  stats,
}: {
  label: string;
  when: string;
  stats: BacktestStats;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">
          {label}
          <span className="ml-2 font-mono text-xs text-text-secondary">
            {formatDate(stats.start_ts * 1000)} – {formatDate(stats.end_ts * 1000)}
          </span>
        </p>
        <p className="text-xs text-text-tertiary mt-0.5">Run {when}</p>
      </div>
      <div className="flex gap-5 text-sm font-mono tabular-nums">
        <span className={stats.return_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {formatPct(stats.return_pct)}
        </span>
        <span className="text-red-600">−{formatNumber(stats.max_drawdown_pct)}%</span>
        <span className="text-text-tertiary">{stats.total_trades} trades</span>
      </div>
    </li>
  );
}

export default function AiStrategyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [detail, setDetail] = useState<AiStrategyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [instances, setInstances] = useState<AiInstance[]>([]);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  /** Fresh backtests run this session, newest first. The API only stores the
   *  latest run server-side, so these live in component state. */
  const [runs, setRuns] = useState<BacktestRun[]>([]);

  const [tab, setTab] = useState('overview');
  const [backtestOpen, setBacktestOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  // Deep link from the builder: /ai-strategies/<id>?action=backtest|deploy
  const searchParams = useSearchParams();
  const deepAction = searchParams?.get('action');
  const [deepHandled, setDeepHandled] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Configuration tab — simple risk-settings form (no raw JSON for users)
  const [risk, setRisk] = useState({ lots: '', sl: '', tp: '', maxPos: '', maxDay: '' });
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await aiApi.get(id);
      setDetail(res);
      const r = (res.dsl?.risk ?? {}) as Record<string, unknown>;
      setRisk({
        lots: r.lots != null ? String(r.lots) : '0.01',
        sl: r.stop_loss_pct != null ? String(r.stop_loss_pct) : '',
        tp: r.take_profit_pct != null ? String(r.take_profit_pct) : '',
        maxPos: r.max_open_positions != null ? String(r.max_open_positions) : '1',
        maxDay: r.max_trades_per_day != null ? String(r.max_trades_per_day) : '10',
      });
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      if (status === 404) setNotFound(true);
      else toast.error(e instanceof Error ? e.message : 'Failed to load strategy');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchInstances = useCallback(async () => {
    try {
      const res = await aiApi.instances();
      setInstances((Array.isArray(res) ? res : []).filter((i) => i.strategy_id === id));
    } catch {
      // keep last-known state
    }
  }, [id]);

  useEffect(() => {
    if (deepHandled || !detail || !deepAction) return;
    setDeepHandled(true);
    if (deepAction === 'backtest') setBacktestOpen(true);
    if (deepAction === 'deploy') {
      if (detail.latest_backtest) setDeployOpen(true);
      else {
        toast('Run a backtest first — deploy unlocks after it completes');
        setBacktestOpen(true);
      }
    }
  }, [deepAction, deepHandled, detail]);

  useEffect(() => {
    void fetchDetail();
    void fetchInstances();
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchInstances();
    }, 10_000);
    return () => clearInterval(t);
  }, [fetchDetail, fetchInstances]);

  const trades = useStrategyTrades(detail?.name ?? null);

  const running = useMemo(() => instances.filter((i) => i.status === 'running'), [instances]);
  const errored = useMemo(
    () => instances.find((i) => i.status === 'error' && i.last_error),
    [instances],
  );

  const latestRun = runs[0] ?? null;
  const displayStats = latestRun?.result.stats ?? detail?.latest_backtest?.stats ?? null;
  const displayCurve = latestRun?.result.equity_curve ?? detail?.latest_backtest?.equity_curve ?? null;
  const hasBacktest = displayStats != null;

  const stopInstance = async (instanceId: string) => {
    setStoppingId(instanceId);
    try {
      await aiApi.stopInstance(instanceId);
      toast.success('Instance stopped');
      void fetchInstances();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to stop instance');
    } finally {
      setStoppingId(null);
    }
  };

  const submitDelete = async () => {
    if (!detail) return;
    setDeleting(true);
    try {
      const res = await aiApi.remove(detail.id);
      toast.success(res?.message || 'Strategy deleted');
      router.push('/ai-strategies');
    } catch (e: unknown) {
      // The server blocks deletes while instances run — surface its wording.
      toast.error(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const saveRisk = async () => {
    if (!detail?.dsl) return;
    const lots = Number(risk.lots);
    const sl = risk.sl.trim() === '' ? null : Number(risk.sl);
    const tp = risk.tp.trim() === '' ? null : Number(risk.tp);
    const maxPos = Number(risk.maxPos);
    const maxDay = Number(risk.maxDay);
    if (!Number.isFinite(lots) || lots <= 0) { setConfigError('Trade size must be a positive number'); return; }
    if (sl !== null && (!Number.isFinite(sl) || sl <= 0)) { setConfigError('Stop loss must be a positive number (or empty)'); return; }
    if (tp !== null && (!Number.isFinite(tp) || tp <= 0)) { setConfigError('Take profit must be a positive number (or empty)'); return; }
    if (!Number.isInteger(maxPos) || maxPos < 1) { setConfigError('Max open positions must be at least 1'); return; }
    if (!Number.isInteger(maxDay) || maxDay < 1) { setConfigError('Max trades per day must be at least 1'); return; }
    const dsl: StrategyDsl = {
      ...detail.dsl,
      risk: {
        lots,
        ...(sl !== null ? { stop_loss_pct: sl } : {}),
        ...(tp !== null ? { take_profit_pct: tp } : {}),
        max_open_positions: maxPos,
        max_trades_per_day: maxDay,
      },
    };
    setConfigSaving(true);
    try {
      const res = await aiApi.update(detail.id, { dsl });
      setDetail(res);
      setConfigError(null);
      toast.success('Risk settings updated');
    } catch (e: unknown) {
      // 400 while instances are running — surface the backend detail.
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setConfigSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      </DashboardShell>
    );
  }

  if (notFound || !detail) {
    return (
      <DashboardShell>
        <EmptyState
          icon={AlertTriangle}
          title="Strategy not found"
          description="It may have been deleted, or the link is wrong."
          action={
            <Link
              href="/ai-strategies"
              className="inline-flex items-center gap-2 rounded-lg border border-border-primary px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <ArrowLeft size={13} /> Back to strategies
            </Link>
          }
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Link
          href="/ai-strategies"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={13} /> All strategies
        </Link>

        <PageHeader
          title={detail.name}
          description={detail.description ?? undefined}
          actions={
            <>
              <button
                type="button"
                onClick={() => setBacktestOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E94E1B]/40 text-[#E94E1B] text-xs font-bold hover:bg-[#E94E1B]/10 transition-colors"
              >
                <TrendingUp size={13} /> Run backtest
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-500/30 text-red-600 text-xs font-semibold hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
              {running.length === 0 && (
                <button
                  type="button"
                  onClick={() => setDeployOpen(true)}
                  disabled={!hasBacktest}
                  title={!hasBacktest ? 'Run a backtest first' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Rocket size={13} /> Deploy
                </button>
              )}
            </>
          }
        />

        {/* Badge row */}
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusPill status={detail.status} />
          <span className="text-xs font-mono font-bold text-text-secondary">
            {detail.dsl?.symbol ?? '—'} · <span className="uppercase">{detail.dsl?.timeframe ?? '—'}</span>
          </span>
          <span className="text-xs text-text-tertiary">Created {formatDate(detail.created_at)}</span>
          {running.length === 0 && !hasBacktest && (
            <span className="text-[11px] text-text-tertiary italic">Run a backtest to unlock Deploy.</span>
          )}
        </div>

        {/* Halted instance */}
        {errored && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-sm text-red-600">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Instance halted</p>
              <p className="mt-0.5 text-xs break-words">{errored.last_error}</p>
              <p className="mt-1.5 text-xs text-red-600/80">
                Nothing resumes automatically — review what happened, fix the strategy or account,
                then redeploy deliberately.
              </p>
            </div>
          </div>
        )}

        {/* Running instances */}
        {running.length > 0 && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700 mb-2">
              Running on {running.length} account{running.length > 1 ? 's' : ''}
            </p>
            <ul className="space-y-1.5">
              {running.map((inst) => (
                <li key={inst.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-text-primary">{inst.account_number}</span>
                    <StatusPill status={inst.status} />
                    <span className="text-text-tertiary">
                      {inst.trades_count} trades
                      {inst.started_at ? ` · since ${formatDateTime(inst.started_at)}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void stopInstance(inst.id)}
                    disabled={stoppingId === inst.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-600 text-[11px] font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Square size={11} /> {stoppingId === inst.id ? 'Stopping…' : 'Stop'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {displayStats && <StatsTiles stats={displayStats} />}

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-card border border-border-primary rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <p className="text-sm font-semibold text-text-primary mb-2">Backtest equity curve</p>
              {displayCurve && displayStats ? (
                <>
                  <EquityCurve curve={displayCurve} />
                  <p className="mt-2 text-[11px] text-text-tertiary tabular-nums">
                    {formatDate(displayStats.start_ts * 1000)} –{' '}
                    {formatDate(displayStats.end_ts * 1000)}
                    {' · '}${formatNumber(displayStats.initial_balance)} starting balance
                    {' · '}
                    {displayStats.bars_used} bars
                  </p>
                </>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No backtest yet"
                  description="Run this strategy against historical data to see how it would have performed."
                  action={
                    <button
                      type="button"
                      onClick={() => setBacktestOpen(true)}
                      className="px-4 py-2.5 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-bold transition-colors"
                    >
                      Run a backtest
                    </button>
                  }
                  className="border-0"
                />
              )}
            </div>

            {detail.explanation && (
              <div className="bg-card border border-border-primary rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <p className="text-sm font-semibold text-text-primary mb-2">How this strategy works</p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">
                  {detail.explanation}
                </p>
              </div>
            )}

            {trades.closed.length > 0 && (
              <div className="bg-card border border-border-primary rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <p className="text-sm font-semibold text-text-primary mb-3">Live performance</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MetricTile
                    label="Realised P&L"
                    value={formatCurrencySigned(trades.realizedPnl)}
                    tone={trades.realizedPnl >= 0 ? 'profit' : 'loss'}
                  />
                  <MetricTile label="Closed trades" value={String(trades.closed.length)} />
                  <MetricTile
                    label="Avg per trade"
                    value={formatCurrencySigned(trades.realizedPnl / trades.closed.length)}
                    tone={trades.realizedPnl >= 0 ? 'profit' : 'loss'}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-4">
            <RuleCard dsl={detail.dsl} />

            <div className="rounded-xl border border-border-primary bg-card p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <h3 className="text-sm font-semibold text-text-primary">Risk settings</h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                Adjust how much this strategy trades. To change the entry/exit rules
                themselves, create a new strategy in the AI Strategy Maker.
              </p>
              {running.length > 0 && (
                <p className="mt-2 text-[11px] text-warning">
                  This strategy has running instances — stop them before changing settings.
                </p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1 text-xs font-medium text-text-secondary">
                  <span>Trade size (lots)</span>
                  <input type="number" step="0.01" min="0.01" value={risk.lots}
                    onChange={(e) => { setRisk((r) => ({ ...r, lots: e.target.value })); setConfigError(null); }}
                    className={inputCls} />
                </label>
                <label className="space-y-1 text-xs font-medium text-text-secondary">
                  <span>Stop loss (% of entry)</span>
                  <input type="number" step="0.1" min="0" placeholder="e.g. 0.5" value={risk.sl}
                    onChange={(e) => { setRisk((r) => ({ ...r, sl: e.target.value })); setConfigError(null); }}
                    className={inputCls} />
                </label>
                <label className="space-y-1 text-xs font-medium text-text-secondary">
                  <span>Take profit (% of entry)</span>
                  <input type="number" step="0.1" min="0" placeholder="e.g. 1.0" value={risk.tp}
                    onChange={(e) => { setRisk((r) => ({ ...r, tp: e.target.value })); setConfigError(null); }}
                    className={inputCls} />
                </label>
                <label className="space-y-1 text-xs font-medium text-text-secondary">
                  <span>Max open positions</span>
                  <input type="number" step="1" min="1" value={risk.maxPos}
                    onChange={(e) => { setRisk((r) => ({ ...r, maxPos: e.target.value })); setConfigError(null); }}
                    className={inputCls} />
                </label>
                <label className="space-y-1 text-xs font-medium text-text-secondary">
                  <span>Max trades per day</span>
                  <input type="number" step="1" min="1" value={risk.maxDay}
                    onChange={(e) => { setRisk((r) => ({ ...r, maxDay: e.target.value })); setConfigError(null); }}
                    className={inputCls} />
                </label>
              </div>
              {configError && <p className="mt-2 text-[11px] text-red-600">{configError}</p>}
              <button
                type="button"
                onClick={() => void saveRisk()}
                disabled={configSaving}
                className="mt-3 px-3.5 py-2 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {configSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {tab === 'trades' && (
          <StrategyTradesPanel
            open={trades.open}
            closed={trades.closed}
            simulatedTrades={latestRun?.result.trades}
            hasBacktest={hasBacktest}
          />
        )}

        {tab === 'history' && (
          <div className="bg-card border border-border-primary rounded-xl px-4 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            {runs.length === 0 && !detail.latest_backtest ? (
              <EmptyState
                icon={History}
                title="No backtests recorded"
                description="Each backtest you run is kept here so you can compare results across parameter changes."
                className="border-0"
              />
            ) : (
              <ul className="divide-y divide-border-primary">
                {runs.map((run, i) => (
                  <HistoryRow
                    key={run.ranAt}
                    label={i === 0 ? 'This session — latest' : 'This session'}
                    when={`${formatDateTime(run.ranAt)} · ${run.days} days · $${formatNumber(run.commissionPerLot)}/lot`}
                    stats={run.result.stats}
                  />
                ))}
                {detail.latest_backtest && (
                  <HistoryRow
                    label="Latest saved"
                    when={formatDateTime(detail.latest_backtest.created_at)}
                    stats={detail.latest_backtest.stats}
                  />
                )}
              </ul>
            )}
            <p className="py-2 text-[10px] text-text-tertiary">
              The server keeps only the most recent backtest; earlier session runs are listed
              here until you leave the page.
            </p>
          </div>
        )}
      </div>

      <BacktestDialog
        open={backtestOpen}
        onClose={() => setBacktestOpen(false)}
        strategyId={detail.id}
        onCompleted={(run) => setRuns((prev) => [run, ...prev])}
      />

      <DeployDialog
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        strategyId={detail.id}
        strategyName={detail.name}
        onDeployed={() => void fetchInstances()}
      />

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        title="Delete this strategy?"
        width="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{detail.name}</span> and its
            backtests are removed permanently. This cannot be undone. Strategies with running
            instances must be stopped first.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void submitDelete()}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-lg border border-red-500/40 text-red-600 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}
