'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { AlertCircle, Bot, Pencil, Play, Rocket, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import RuleCard from '@/components/ai-strategies/RuleCard';
import BacktestPanel from '@/components/ai-strategies/BacktestPanel';
import { useTradingStore } from '@/stores/tradingStore';
import api from '@/lib/api/client';
import { formatDate, formatDateTime, formatNumber } from '@/lib/formatters';
import {
  aiApi,
  type AiStrategyDetail,
  type AiStrategySummary,
  type BacktestResult,
  type StrategyDsl,
} from '@/lib/ai-strategies';

const inputCls =
  'w-full bg-bg-secondary border border-border-primary rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50';

const BACKTEST_DAYS = [30, 90, 180, 365] as const;

interface DeployAccount {
  id: string;
  account_number: string;
  balance: number;
  currency?: string;
  is_demo?: boolean;
}

function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E94E1B] border-t-transparent" />;
}

function StatusPill({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const cls =
    s === 'active' || s === 'running'
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
      : s === 'error'
        ? 'bg-red-500/10 text-red-600 border-red-500/25'
        : 'bg-bg-secondary text-text-tertiary border-border-primary';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide', cls)}>
      {status || '—'}
    </span>
  );
}

export default function StrategiesTab() {
  const storeAccounts = useTradingStore((s) => s.accounts);

  const [strategies, setStrategies] = useState<AiStrategySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AiStrategyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Backtest
  const [btDays, setBtDays] = useState<number>(90);
  const [btRunning, setBtRunning] = useState(false);
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);

  // Deploy
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployAccounts, setDeployAccounts] = useState<DeployAccount[]>([]);
  const [deployAccountId, setDeployAccountId] = useState('');
  const [deploying, setDeploying] = useState(false);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editJson, setEditJson] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) { setLoading(true); setListError(null); }
    try {
      const res = await aiApi.list();
      setStrategies(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      if (!opts.silent) setListError(e instanceof Error ? e.message : 'Failed to load strategies');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchList(); }, [fetchList]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setBtResult(null);
    setDetailLoading(true);
    try {
      const res = await aiApi.get(id);
      setDetail(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load strategy');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const runBacktest = async () => {
    if (!detail) return;
    setBtRunning(true);
    try {
      const res = await aiApi.backtest(detail.id, { days: btDays });
      setBtResult(res);
      toast.success('Backtest complete');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Backtest failed');
    } finally {
      setBtRunning(false);
    }
  };

  const openDeploy = async () => {
    setDeployOpen(true);
    // Prefer the live trading store; on non-terminal pages it may be empty, so
    // fall back to fetching /accounts directly.
    if (storeAccounts.length > 0) {
      setDeployAccounts(storeAccounts.map((a) => ({
        id: a.id, account_number: a.account_number, balance: a.balance, currency: a.currency, is_demo: a.is_demo,
      })));
      setDeployAccountId(storeAccounts[0]?.id ?? '');
      return;
    }
    try {
      const res = await api.get<{ items?: DeployAccount[] } | DeployAccount[]>('/accounts');
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      setDeployAccounts(items);
      setDeployAccountId(items[0]?.id ?? '');
    } catch {
      setDeployAccounts([]);
    }
  };

  const submitDeploy = async () => {
    if (!detail || !deployAccountId) { toast.error('Pick a trading account'); return; }
    setDeploying(true);
    try {
      await aiApi.deploy(detail.id, deployAccountId);
      toast.success('Strategy deployed — see Live Instances');
      setDeployOpen(false);
      void fetchList({ silent: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  const openEdit = () => {
    if (!detail) return;
    setEditName(detail.name);
    setEditDesc(detail.description ?? '');
    setEditJson(JSON.stringify(detail.dsl ?? {}, null, 2));
    setEditError(null);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!detail) return;
    if (!editName.trim()) { setEditError('Name is required'); return; }
    let dsl: StrategyDsl;
    try {
      dsl = JSON.parse(editJson) as StrategyDsl;
      if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) throw new Error('Strategy JSON must be an object');
    } catch (e: unknown) {
      setEditError(e instanceof Error ? `Invalid JSON: ${e.message}` : 'Invalid JSON');
      return;
    }
    setEditSaving(true);
    try {
      await aiApi.update(detail.id, { name: editName.trim(), description: editDesc.trim() || undefined, dsl });
      toast.success('Strategy updated');
      setEditOpen(false);
      void fetchList({ silent: true });
      void openDetail(detail.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const submitDelete = async () => {
    if (!detail) return;
    setDeleting(true);
    try {
      const res = await aiApi.remove(detail.id);
      toast.success(res?.message || 'Strategy deleted');
      setDeleteOpen(false);
      setSelectedId(null);
      setDetail(null);
      void fetchList({ silent: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  if (listError) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
        <div className="flex items-center gap-2"><AlertCircle size={14} /> {listError}</div>
        <button type="button" onClick={() => void fetchList()} className="text-xs px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors">Retry</button>
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border-primary flex items-center justify-center mb-4">
          <Bot size={24} className="text-text-tertiary" />
        </div>
        <p className="text-text-primary font-medium">No strategies yet</p>
        <p className="text-sm text-text-tertiary mt-1">Use the Builder tab to create your first AI strategy</p>
      </div>
    );
  }

  const shownBacktest = btResult ?? (detail?.latest_backtest
    ? { stats: detail.latest_backtest.stats, equity_curve: detail.latest_backtest.equity_curve }
    : null);

  return (
    <div className="space-y-4">
      {/* Strategy cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => void openDetail(s.id)}
            className={clsx(
              'text-left bg-card border rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-colors',
              selectedId === s.id ? 'border-[#E94E1B]/60 ring-1 ring-[#E94E1B]/20' : 'border-border-primary hover:border-accent/30',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary truncate">{s.name}</p>
              <StatusPill status={s.status} />
            </div>
            {s.description && <p className="text-[11px] text-text-tertiary mt-1 line-clamp-2">{s.description}</p>}
            <div className="flex items-center gap-2 mt-3 text-[10px]">
              <span className="font-mono font-bold text-text-primary">{s.symbol}</span>
              <span className="px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary font-semibold uppercase">{s.timeframe}</span>
              {s.running_instances > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {s.running_instances} running
                </span>
              )}
            </div>
            <p className="text-[10px] text-text-tertiary mt-2">Updated {formatDate(s.updated_at)}</p>
          </button>
        ))}
      </div>

      {/* Selected strategy detail panel */}
      {selectedId && (
        <div className="bg-card border border-border-primary rounded-xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          {detailLoading && <div className="flex items-center justify-center py-12"><Spinner /></div>}
          {!detailLoading && detail && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary truncate">{detail.name}</h3>
                    <StatusPill status={detail.status} />
                  </div>
                  {detail.description && <p className="text-xs text-text-secondary mt-0.5">{detail.description}</p>}
                  {detail.prompt && (
                    <p className="text-[11px] text-text-tertiary mt-1 italic line-clamp-2">&ldquo;{detail.prompt}&rdquo;</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={openEdit} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-primary text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                  <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-xs font-semibold text-red-600 hover:bg-red-500/10 transition-colors">
                    <Trash2 size={12} /> Delete
                  </button>
                  <button type="button" onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors" aria-label="Close details">
                    <X size={14} />
                  </button>
                </div>
              </div>

              <RuleCard dsl={detail.dsl} />

              {/* Backtest + deploy actions */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <div className="inline-flex items-center gap-1 rounded-lg border border-border-primary bg-bg-secondary p-0.5">
                  {BACKTEST_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setBtDays(d)}
                      className={clsx(
                        'px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors',
                        btDays === d ? 'bg-[#E94E1B] text-white' : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void runBacktest()}
                  disabled={btRunning}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E94E1B]/40 text-[#E94E1B] text-xs font-bold hover:bg-[#E94E1B]/10 transition-colors disabled:opacity-50"
                >
                  <Play size={13} /> {btRunning ? 'Running…' : 'Run Backtest'}
                </button>
                <button
                  type="button"
                  onClick={() => void openDeploy()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E94E1B] hover:bg-[#C73E11] text-white text-xs font-bold transition-colors"
                >
                  <Rocket size={13} /> Deploy
                </button>
              </div>

              {shownBacktest && (
                <BacktestPanel
                  stats={shownBacktest.stats}
                  curve={shownBacktest.equity_curve}
                  trades={btResult?.trades}
                  subtitle={
                    btResult
                      ? `Fresh backtest — last ${btDays} days`
                      : detail.latest_backtest
                        ? `Latest saved backtest · ${formatDateTime(detail.latest_backtest.created_at)}`
                        : undefined
                  }
                />
              )}
              {!shownBacktest && (
                <p className="text-[11px] text-text-tertiary">No backtest yet — run one to see how this strategy would have performed.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Deploy modal */}
      <Modal open={deployOpen} onClose={() => { if (!deploying) setDeployOpen(false); }} title={detail ? `Deploy "${detail.name}"` : 'Deploy Strategy'} width="sm">
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            The strategy will trade live on the selected account, following its rules and risk settings.
          </p>
          {deployAccounts.length === 0 ? (
            <p className="text-[11px] text-text-tertiary py-3 text-center">No trading accounts found.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {deployAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setDeployAccountId(a.id)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    deployAccountId === a.id
                      ? 'border-[#E94E1B]/60 bg-[#E94E1B]/5'
                      : 'border-border-primary hover:bg-bg-hover',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-semibold text-text-primary">{a.account_number}</span>
                    {a.is_demo && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-warning/15 text-warning">Demo</span>
                    )}
                  </div>
                  <span className="text-xs font-mono tabular-nums text-text-secondary shrink-0">
                    ${formatNumber(a.balance)} {a.currency && a.currency !== 'USD' ? a.currency : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setDeployOpen(false)} disabled={deploying}
              className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => void submitDeploy()} disabled={deploying || !deployAccountId}
              className="flex-1 py-2.5 rounded-lg bg-[#E94E1B] text-white text-xs font-bold hover:bg-[#C73E11] disabled:opacity-50 transition-colors">
              {deploying ? 'Deploying…' : 'Confirm Deploy'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => { if (!editSaving) setEditOpen(false); }} title="Edit Strategy" width="2xl">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Description</label>
              <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Strategy JSON (DSL)</label>
            <textarea
              rows={16}
              value={editJson}
              onChange={(e) => { setEditJson(e.target.value); setEditError(null); }}
              spellCheck={false}
              className={clsx(inputCls, 'font-mono text-[11px] leading-relaxed resize-y')}
            />
          </div>
          {editError && <p className="text-[11px] text-red-600">{editError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditOpen(false)} disabled={editSaving}
              className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => void submitEdit()} disabled={editSaving}
              className="flex-1 py-2.5 rounded-lg bg-[#E94E1B] text-white text-xs font-bold hover:bg-[#C73E11] disabled:opacity-50 transition-colors">
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={deleteOpen} onClose={() => { if (!deleting) setDeleteOpen(false); }} title="Delete Strategy" width="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Delete <span className="font-semibold text-text-primary">{detail?.name}</span>? This cannot be undone.
            Strategies with running instances must be stopped first.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleting}
              className="flex-1 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => void submitDelete()} disabled={deleting}
              className="flex-1 py-2.5 rounded-lg border border-red-500/40 text-red-600 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50 transition-colors">
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
