'use client';

import { useState, useEffect, useCallback, useMemo, Suspense, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import { getErrorMessage } from '@/lib/errors';
import MasterEligibilityBanner from '@/components/social/MasterEligibilityBanner';
import {
  DollarSign,
  TrendingUp,
  ArrowDownToLine,
  Users,
  Clock,
  GraduationCap,
  ShieldCheck,
  BarChart2,
  Search,
  ArrowRight,
} from 'lucide-react';

type TabId = 'leaderboard' | 'my-copies' | 'become-provider' | 'my-dashboard' | 'trade-history';
type SortBy = 'total_return_pct' | 'sharpe_ratio' | 'followers_count';

interface Provider {
  id: string;
  user_id: string;
  provider_name: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  followers_count: number;
  performance_fee_pct: number;
  min_investment: number;
  description: string;
  strategy_info: Record<string, string> | null;
  created_at: string;
  is_copying: boolean;
}

interface ProviderDetail extends Provider {
  active_investors: number;
  total_trades: number;
  total_profit: number;
  win_rate: number;
  monthly_breakdown: { month: string; profit: number }[];
  is_copying: boolean;
}

interface CopySubscription {
  id: string;
  master_id: string;
  provider_name: string;
  allocation_amount: number;
  total_profit: number;
  total_return_pct: number;
  copy_type: string;
  status: string;
  open_trades?: number;
  closed_trades?: number;
  total_trades?: number;
  created_at: string;
}

interface CopyTradeRow {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price?: number;
  opened_at?: string | null;
  closed_at?: string | null;
  pnl?: number;
  your_share?: number;
  master_pnl?: number;
  close_reason?: string;
  status: string;
}

interface CopyTradesResponse {
  allocation_id: string;
  copy_type: string;
  open_trades: CopyTradeRow[];
  closed_trades: CopyTradeRow[];
  open_count: number;
  closed_count: number;
  your_ratio_pct?: number;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'my-copies', label: 'My Subscriptions' },
  { id: 'become-provider', label: 'Become Trade Master' },
  { id: 'my-dashboard', label: 'My Dashboard' },
  { id: 'trade-history', label: 'Trade History' },
];

const VALID_TAB_IDS = new Set<TabId>(TABS.map((t) => t.id));

function tabFromQuery(param: string | null): TabId {
  if (param && VALID_TAB_IDS.has(param as TabId)) return param as TabId;
  return 'leaderboard';
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'total_return_pct', label: 'Return' },
];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
      <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-sell/10 border border-sell/30 text-sell text-sm mb-4">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 px-3 py-1 rounded text-xs font-medium border border-sell/40 hover:bg-sell/20 transition-colors">
        Retry
      </button>
    </div>
  );
}

/* ─── Mini bar chart for monthly breakdown ─── */
function MonthlyChart({ data }: { data: { month: string; profit: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Math.abs(d.profit)), 1);
  return (
    <div className="mt-4">
      <div className="text-xs text-text-tertiary mb-2">Monthly Breakdown</div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d) => {
          const pct = (Math.abs(d.profit) / max) * 100;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={clsx('w-full rounded-t', d.profit >= 0 ? 'bg-buy' : 'bg-sell')}
                style={{ height: `${Math.max(pct, 4)}%` }}
                title={`${d.month}: ${d.profit >= 0 ? '+' : ''}${d.profit.toFixed(2)}`}
              />
              <span className="text-[9px] text-text-tertiary truncate w-full text-center">{d.month.slice(-3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Provider Card (TraderCard pattern) ─── */
function TraderCard({
  provider,
  onClick,
  onCopy,
  isSelf,
  onViewFollowers,
}: {
  provider: Provider;
  onClick: () => void;
  onCopy: (e: React.MouseEvent) => void;
  isSelf?: boolean;
  onViewFollowers?: (e: React.MouseEvent) => void;
}) {
  const initials = provider.provider_name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative rounded-xl overflow-hidden border transition-all min-h-[200px] flex flex-col cursor-pointer group',
        'border-border-primary bg-bg-secondary hover:border-accent/45',
        '[data-theme="light"]:bg-bg-tertiary [data-theme="light"]:border-black'
      )}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <svg className="absolute bottom-0 left-0 w-full h-20" viewBox="0 0 400 80" preserveAspectRatio="none">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            d="M0 40 Q100 10 200 40 T400 40 L400 80 L0 80 Z"
            className="text-[var(--text-tertiary)]"
          />
        </svg>
      </div>

      <div className="relative z-10 p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-bg-tertiary border border-border-glass flex items-center justify-center text-sm font-bold text-text-primary shrink-0 [data-theme='light']:border-black">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-text-primary truncate">{provider.provider_name}</span>
                <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[9px] font-bold uppercase shrink-0">Master</span>
                {isSelf && <span className="px-1.5 py-0.5 rounded bg-buy/15 text-buy text-[9px] font-bold uppercase shrink-0">You</span>}
              </div>
              <div className="text-xxs text-text-tertiary mt-0.5">Fee: {provider.performance_fee_pct}% · {provider.followers_count} followers</div>
            </div>
          </div>
          {isSelf ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onViewFollowers}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-buy/40 text-buy hover:bg-buy/15 transition-all"
              >
                {provider.followers_count} Followers
              </button>
              {provider.is_copying && (
                <a
                  href="/social?tab=my-copies"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-danger/40 text-danger hover:bg-danger/15 transition-all"
                  title="You're mirroring your own master — click to stop"
                >
                  Stop Self-Follow
                </a>
              )}
            </div>
          ) : provider.is_copying ? (
            <span className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-success/40 text-success bg-success/10">
              Following
            </span>
          ) : (
            <button
              type="button"
              onClick={onCopy}
              className={clsx(
                'shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all',
                'border-accent text-accent hover:bg-accent hover:text-black',
                '[data-theme="light"]:border-black [data-theme="light"]:text-black [data-theme="light"]:hover:bg-black [data-theme="light"]:hover:text-[#F2EFE9]'
              )}
            >
              Follow
            </button>
          )}
        </div>

        <div className="mb-4">
          <div className="text-xxs text-text-tertiary mb-0.5">Total ROI</div>
          <div className={clsx('text-xl sm:text-2xl font-bold tabular-nums font-mono', provider.total_return_pct >= 0 ? 'text-buy' : 'text-sell')}>
            {provider.total_return_pct >= 0 ? '+' : ''}{provider.total_return_pct.toFixed(2)}%
          </div>
        </div>

        {provider.strategy_info?.strategy_name && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {provider.strategy_info.market && (
              <span className="px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-medium text-accent">{provider.strategy_info.market}</span>
            )}
            {provider.strategy_info.risk_profile && (
              <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                (provider.strategy_info.risk_profile || '').toLowerCase() === 'moderate' ? 'bg-warning/15 text-warning border border-warning/20' :
                ['low', 'conservative'].includes((provider.strategy_info.risk_profile || '').toLowerCase()) ? 'bg-success/15 text-success border border-success/20' :
                'bg-sell/15 text-sell border border-sell/20'
              )}>{provider.strategy_info.risk_profile}</span>
            )}
            {provider.strategy_info.expected_returns && (
              <span className="px-2 py-0.5 rounded-full bg-buy/10 border border-buy/20 text-[10px] font-medium text-buy">{provider.strategy_info.expected_returns}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-auto pt-3 border-t border-border-glass [data-theme='light']:border-black">
          <div>
            <div className="text-xxs text-text-tertiary">Drawdown</div>
            <div className="text-xs font-semibold tabular-nums text-sell">{provider.max_drawdown_pct.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xxs text-text-tertiary">Sharpe</div>
            <div className="text-xs font-semibold tabular-nums text-text-primary">{provider.sharpe_ratio.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xxs text-text-tertiary">Followers</div>
            <div className="text-xs font-semibold tabular-nums text-text-primary">{provider.followers_count.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Modal ─── */
function DetailModal({
  detail,
  loading,
  onClose,
  onCopy,
}: {
  detail: ProviderDetail | null;
  loading: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-bg-secondary border border-border-glass p-6 overflow-y-auto max-h-[90vh]"
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary text-lg">✕</button>

        {loading ? (
          <Spinner />
        ) : detail ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary border border-border-glass flex items-center justify-center text-sm font-bold text-text-primary">
                {detail.provider_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">{detail.provider_name}</div>
                <div className="text-xxs text-text-tertiary">Since {new Date(detail.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total ROI', value: `${detail.total_return_pct >= 0 ? '+' : ''}${detail.total_return_pct.toFixed(2)}%`, color: detail.total_return_pct >= 0 ? 'text-buy' : 'text-sell' },
                { label: 'Max DD', value: `${detail.max_drawdown_pct.toFixed(2)}%`, color: 'text-sell' },
                { label: 'Sharpe', value: detail.sharpe_ratio.toFixed(2), color: 'text-text-primary' },
                { label: 'Win Rate', value: `${detail.win_rate.toFixed(1)}%`, color: 'text-text-primary' },
                { label: 'Total Trades', value: detail.total_trades.toLocaleString(), color: 'text-text-primary' },
                { label: 'Total Profit', value: `$${detail.total_profit.toLocaleString()}`, color: detail.total_profit >= 0 ? 'text-buy' : 'text-sell' },
                { label: 'Followers', value: detail.followers_count.toLocaleString(), color: 'text-text-primary' },
                { label: 'Investors', value: detail.active_investors.toLocaleString(), color: 'text-text-primary' },
                { label: 'Fee', value: `${detail.performance_fee_pct}%`, color: 'text-text-primary' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-bg-primary/50 p-2">
                  <div className="text-xxs text-text-tertiary">{s.label}</div>
                  <div className={clsx('text-sm font-semibold tabular-nums', s.color)}>{s.value}</div>
                </div>
              ))}
            </div>

            {detail.description && (
              <p className="text-xs text-text-secondary mb-4">{detail.description}</p>
            )}

            {detail.strategy_info && Object.keys(detail.strategy_info).length > 0 && (
              <div className="mb-4"><StrategyInfoCard info={detail.strategy_info} /></div>
            )}

            <MonthlyChart data={detail.monthly_breakdown} />

            <button
              type="button"
              onClick={onCopy}
              disabled={detail.is_copying}
              className={clsx(
                'w-full mt-5 py-2.5 rounded-lg text-sm font-semibold transition-all',
                detail.is_copying
                  ? 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
                  : 'bg-accent text-black hover:bg-accent/90'
              )}
            >
              {detail.is_copying ? 'Already Following' : 'Follow Manager'}
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ─── Copy Modal ─── */
interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  is_demo?: boolean;
}

function CopyModal({
  provider,
  onClose,
  onSuccess,
}: {
  provider: Provider | ProviderDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  // Destination mode: a new dedicated CF account funded from main wallet,
  // or an existing live account the follower already trades from.
  const [destMode, setDestMode] = useState<'new' | 'existing'>('new');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, walRes] = await Promise.all([
          api.get<{ items: TradingAccount[] } | TradingAccount[]>('/accounts'),
          api.get<{ main_wallet_balance?: number }>('/wallet/summary'),
        ]);
        if (cancelled) return;
        const items: TradingAccount[] = Array.isArray(accRes)
          ? accRes
          : (accRes?.items ?? []);
        setAccounts(items.filter((a) => !a.is_demo));
        setWalletBalance(Number(walRes.main_wallet_balance) || 0);
      } catch {
        // non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (destMode === 'new' && amt > walletBalance) {
      toast.error('Insufficient wallet balance');
      return;
    }
    if (destMode === 'existing') {
      if (!selectedAccountId) { toast.error('Pick a destination account'); return; }
      if (selectedAccount && amt > selectedAccount.balance) {
        toast.error(`Account balance $${selectedAccount.balance.toFixed(2)} is below allocation`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const qs =
        destMode === 'existing' && selectedAccountId
          ? `?master_id=${provider.id}&account_id=${selectedAccountId}&amount=${amt}`
          : `?master_id=${provider.id}&amount=${amt}`;
      await api.post(`/social/copy${qs}`, {});
      toast.success(
        destMode === 'existing'
          ? `Now following ${provider.provider_name} — trades will mirror into ${selectedAccount?.account_number}`
          : `Now following ${provider.provider_name} — $${amt.toFixed(2)} deducted from wallet`,
      );
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start subscription');
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-bg-secondary border border-border-glass p-6"
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary text-lg">✕</button>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Follow {provider.provider_name}</h3>
        <p className="text-xxs text-text-tertiary mb-4">Performance fee: {provider.performance_fee_pct}% · Min: ${provider.min_investment}</p>

        {/* Destination picker — new dedicated CF account vs an existing live account */}
        <div className="rounded-lg border border-accent/30 bg-bg-primary p-3 mb-3 space-y-3">
          <p className="text-xs font-semibold text-accent">Where should mirrored trades go?</p>
          <div className="grid grid-cols-1 gap-2">
            <label
              className={clsx(
                'cursor-pointer rounded-lg border p-2.5 text-xxs transition-colors',
                destMode === 'new'
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-border-glass bg-bg-secondary hover:border-accent/30',
              )}
            >
              <input
                type="radio"
                name="dest-mode"
                checked={destMode === 'new'}
                onChange={() => {
                  setDestMode('new');
                  setSelectedAccountId('');
                }}
                className="sr-only"
              />
              <p className="font-semibold text-text-primary">Create new dedicated account</p>
              <p className="text-text-tertiary mt-0.5 leading-snug">
                A fresh CF account is opened and funded from your main wallet.
              </p>
            </label>
            <label
              className={clsx(
                'cursor-pointer rounded-lg border p-2.5 text-xxs transition-colors',
                destMode === 'existing'
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-border-glass bg-bg-secondary hover:border-accent/30',
                accounts.length === 0 && 'opacity-60 cursor-not-allowed',
              )}
            >
              <input
                type="radio"
                name="dest-mode"
                checked={destMode === 'existing'}
                disabled={accounts.length === 0}
                onChange={() => setDestMode('existing')}
                className="sr-only"
              />
              <p className="font-semibold text-text-primary">Use an existing account</p>
              <p className="text-text-tertiary mt-0.5 leading-snug">
                {accounts.length === 0
                  ? 'No live accounts available.'
                  : 'Mirrored trades land in an account you already trade from.'}
              </p>
            </label>
          </div>
          {destMode === 'existing' && accounts.length > 0 && (
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Destination account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-xs text-text-primary font-mono focus:border-accent/50 focus:outline-none"
              >
                <option value="">— Select —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} · ${a.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-warning mt-1 leading-snug">
                Heads up: mirrored trades will mix with your own trades on this account, and lot sizing scales with the account&apos;s full equity.
              </p>
            </div>
          )}
        </div>

        {destMode === 'new' && (
          <div className="rounded-lg border border-accent/30 bg-bg-primary p-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">From Main Wallet</div>
              <div className="text-lg font-bold text-accent font-mono tabular-nums">${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <button type="button" onClick={() => setAmount(String(Math.max(0, walletBalance)))} className="text-xs font-bold text-accent hover:underline">Max</button>
          </div>
        )}

        <label className="block text-xs text-text-secondary mb-1">
          {destMode === 'existing' ? 'Allocation Amount (USD)' : 'Investment Amount (USD)'}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={provider.min_investment}
          max={destMode === 'existing' ? (selectedAccount?.balance ?? undefined) : walletBalance}
          placeholder={`Min $${provider.min_investment}`}
          className="mb-4 w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent/50 focus:outline-none [data-theme='light']:border-black"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            submitting ||
            // In "new account" mode the backend creates a fresh CF account
            // from main wallet, so no existing account is needed. Only the
            // "existing" mode requires accounts.length > 0 + a selected id.
            (destMode === 'existing' && (accounts.length === 0 || !selectedAccountId))
          }
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-black transition-all hover:bg-accent/90 disabled:opacity-50"
        >
          {submitting ? 'Processing…' : 'Start Following'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Leaderboard Tab ─── */
function LeaderboardTab() {
  const { user } = useAuthStore();
  const currentUserId = user?.id || '';
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('total_return_pct');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [copyTarget, setCopyTarget] = useState<Provider | ProviderDetail | null>(null);

  /* Followers modal */
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  const loadFollowers = async (e: React.MouseEvent, providerId: string, isSelf: boolean) => {
    e.stopPropagation();
    setFollowersLoading(true);
    try {
      const endpoint = isSelf ? '/followers/my-followers' : `/followers/provider/${providerId}`;
      const res = await api.get<any>(endpoint);
      setFollowers(res.followers || []);
      setShowFollowers(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to load followers'));
    } finally {
      setFollowersLoading(false);
    }
  };

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Provider>>('/social/leaderboard', {
        sort_by: sortBy,
        page: String(page),
        per_page: '20',
      });
      setProviders(res.items);
      setTotalPages(res.pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [sortBy, page]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api.get<ProviderDetail>(`/social/providers/${id}`);
      setDetail(d);
    } catch {
      toast.error('Failed to load provider details');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      {/* Sort bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-text-tertiary mr-1">Sort by:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setSortBy(opt.value); setPage(1); }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              sortBy === opt.value
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border-glass text-text-secondary hover:text-text-primary'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchLeaderboard} />}
      {loading ? <Spinner /> : providers.length === 0 ? (
        <EmptyState message="No providers found" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {providers.map((p) => (
              <TraderCard
                key={p.id}
                provider={p}
                isSelf={p.user_id === currentUserId}
                onClick={() => openDetail(p.id)}
                onCopy={(e) => { e.stopPropagation(); setCopyTarget(p); }}
                onViewFollowers={(e) => loadFollowers(e, p.id, p.user_id === currentUserId)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg text-xs border border-border-glass text-text-secondary disabled:opacity-30 hover:text-text-primary transition-all"
              >
                ← Prev
              </button>
              <span className="text-xs text-text-tertiary tabular-nums">{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs border border-border-glass text-text-secondary disabled:opacity-30 hover:text-text-primary transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selectedId && (
        <DetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelectedId(null)}
          onCopy={() => { setSelectedId(null); setCopyTarget(detail); }}
        />
      )}

      {/* Copy modal */}
      {copyTarget && (
        <CopyModal
          provider={copyTarget}
          onClose={() => setCopyTarget(null)}
          onSuccess={() => { setCopyTarget(null); fetchLeaderboard(); }}
        />
      )}

      {/* Followers modal */}
      {showFollowers && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-bg-base/75 backdrop-blur-sm p-4" onClick={() => setShowFollowers(false)}>
          <div className="w-full max-w-3xl bg-bg-secondary border border-border-glass rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-glass">
              <h3 className="text-base font-bold text-text-primary">Followers ({followers.length})</h3>
              <button onClick={() => setShowFollowers(false)} className="text-text-tertiary hover:text-text-primary text-lg">✕</button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {followersLoading ? <Spinner /> : followers.length === 0 ? (
                <div className="text-center py-12 text-sm text-text-tertiary">No followers yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-glass">
                        {['Follower', 'Investment', 'Profit/Loss', 'Trades', 'Joined'].map(c => (
                          <th key={c} className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {followers.map((f: any) => (
                        <tr key={f.id} className="border-b border-border-glass/50 hover:bg-bg-hover/30">
                          <td className="px-3 py-3">
                            <p className="text-xs font-medium text-text-primary">{f.user_name}</p>
                            {f.account_number && <p className="text-xxs text-text-tertiary">{f.account_number}</p>}
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-text-primary">${(f.allocation_amount || 0).toLocaleString()}</td>
                          <td className="px-3 py-3">
                            <span className={clsx('text-xs font-mono font-bold', (f.total_profit || 0) >= 0 ? 'text-buy' : 'text-sell')}>
                              {(f.total_profit || 0) >= 0 ? '+' : ''}${(f.total_profit || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-mono text-text-primary">{f.total_copied_trades || 0}</td>
                          <td className="px-3 py-3 text-xxs text-text-tertiary">{f.joined_at ? new Date(f.joined_at).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── My Copies Tab ─── */
function MyCopiesTab() {
  const [copies, setCopies] = useState<CopySubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [tradesTarget, setTradesTarget] = useState<CopySubscription | null>(null);
  const [tradesData, setTradesData] = useState<CopyTradesResponse | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [refillTarget, setRefillTarget] = useState<CopySubscription | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refilling, setRefilling] = useState(false);
  const [walletBal, setWalletBal] = useState(0);
  const [earnings, setEarnings] = useState<{ total_profit: number; commission_to_master: number; total_invested: number } | null>(null);

  const fetchCopies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: CopySubscription[]; total: number }>('/social/my-copies');
      setCopies(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load copies');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWalletBal = useCallback(async () => {
    try {
      const s = await api.get<{ main_wallet_balance?: number }>('/wallet/summary');
      setWalletBal(Number(s.main_wallet_balance) || 0);
    } catch { setWalletBal(0); }
  }, []);

  const fetchEarnings = useCallback(async () => {
    try {
      const e = await api.get<{ total_profit: number; commission_to_master: number; total_invested: number }>('/social/follower-earnings');
      setEarnings(e);
    } catch { setEarnings(null); }
  }, []);

  useEffect(() => { fetchCopies(); fetchWalletBal(); fetchEarnings(); }, [fetchCopies, fetchWalletBal, fetchEarnings]);

  const stopCopy = async (id: string, name: string) => {
    setStoppingId(id);
    try {
      const res = await api.delete<{ returned_to_wallet?: number }>(`/social/copy/${id}`);
      const returned = res?.returned_to_wallet;
      toast.success(returned != null ? `Stopped following ${name} — $${returned.toFixed(2)} returned to wallet` : `Stopped following ${name}`);
      setCopies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop subscription');
    } finally {
      setStoppingId(null);
    }
  };

  const withdrawManaged = async (id: string, name: string) => {
    if (!confirm(`Withdraw from ${name}? All open positions will be closed at market price.`)) return;
    setStoppingId(id);
    try {
      await api.delete(`/social/mamm-pamm/${id}/withdraw`);
      toast.success(`Withdrawn from ${name}`);
      setCopies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setStoppingId(null);
    }
  };

  const openRefill = (c: CopySubscription) => {
    setRefillTarget(c);
    setRefillAmount('');
    fetchWalletBal();
  };

  const openTrades = async (c: CopySubscription) => {
    setTradesTarget(c);
    setTradesData(null);
    setTradesLoading(true);
    try {
      const res = await api.get<CopyTradesResponse>(`/social/copies/${c.id}/trades`);
      setTradesData(res);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load copy trades'));
      setTradesTarget(null);
    } finally {
      setTradesLoading(false);
    }
  };

  // Live-refresh the open copy trades while the modal is open — the backend
  // recomputes each position's P&L from the current tick, so a 2 s poll keeps
  // the follower's P&L moving with the price (same cadence as positions).
  useEffect(() => {
    if (!tradesTarget) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const res = await api.get<CopyTradesResponse>(`/social/copies/${tradesTarget.id}/trades`);
        if (!cancelled) setTradesData(res);
      } catch {
        /* ignore transient blips — next tick retries */
      }
    };
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tradesTarget]);

  const submitRefill = async () => {
    if (!refillTarget) return;
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBal) { toast.error('Insufficient wallet balance'); return; }
    setRefilling(true);
    try {
      // Use the invest endpoint — it now supports top-up for existing allocations
      const isCopy = refillTarget.copy_type === 'signal';
      if (isCopy) {
        // For signal copies, use the copy endpoint with same master
        await api.post(`/social/copy?master_id=${refillTarget.master_id}&account_id=${refillTarget.id}&amount=${amt}`, {});
      } else {
        // For PAMM/MAM, use the invest endpoint (supports top-up)
        const accts = await api.get<{ items: Array<{ id: string }> }>('/accounts');
        const firstLive = (accts.items ?? [])[0];
        if (!firstLive) { toast.error('No trading account found'); setRefilling(false); return; }
        await api.post(`/social/mamm-pamm/${refillTarget.master_id}/invest?account_id=${firstLive.id}&amount=${amt}`, {});
      }
      toast.success(`Added $${amt.toFixed(2)} to ${refillTarget.provider_name}`);
      setRefillTarget(null);
      fetchCopies();
      fetchWalletBal();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Refill failed');
    } finally {
      setRefilling(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={fetchCopies} />;
  if (copies.length === 0) return <EmptyState message="No active Trade Master subscriptions yet" />;

  return (
    <div className="space-y-3">
      {/* Follower earnings summary — profit kept vs commission paid to masters */}
      {earnings && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-border-primary">
            <h3 className="text-sm font-semibold text-text-primary">Your Copy-Trading Earnings</h3>
            <p className="text-xxs text-text-tertiary mt-0.5">What you kept from copying, and the performance-fee commission paid to your masters</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
            <div>
              <p className="text-xxs text-text-tertiary">Profit from Copy Trading</p>
              <p className={clsx('text-lg font-bold font-mono tabular-nums', earnings.total_profit >= 0 ? 'text-buy' : 'text-sell')}>
                {earnings.total_profit >= 0 ? '+' : ''}${earnings.total_profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-text-tertiary mt-0.5">Net, after fees</p>
            </div>
            <div>
              <p className="text-xxs text-text-tertiary">Commission Paid to Master</p>
              <p className="text-lg font-bold font-mono tabular-nums text-warning">
                ${earnings.commission_to_master.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-text-tertiary mt-0.5">Performance fees</p>
            </div>
            <div>
              <p className="text-xxs text-text-tertiary">Total Invested</p>
              <p className="text-lg font-bold font-mono tabular-nums text-text-primary">
                ${earnings.total_invested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-text-tertiary mt-0.5">Active allocations</p>
            </div>
          </div>
        </div>
      )}
      {copies.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-bg-secondary border border-border-glass [data-theme='light']:bg-bg-tertiary [data-theme='light']:border-black"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-text-primary truncate">{c.provider_name}</span>
              <span className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                c.status === 'active' ? 'bg-buy/20 text-buy' : 'bg-text-tertiary/20 text-text-tertiary'
              )}>
                {c.status}
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase bg-accent/15 text-accent">
                {c.copy_type || 'signal'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              <span>Allocated: <span className="text-text-primary font-medium">${c.allocation_amount.toLocaleString()}</span></span>
              <span>PnL: <span className={clsx('font-medium', c.total_profit >= 0 ? 'text-buy' : 'text-sell')}>{c.total_profit >= 0 ? '+' : ''}${c.total_profit.toLocaleString()}</span></span>
              <span>ROI: <span className={clsx('font-medium', c.total_return_pct >= 0 ? 'text-buy' : 'text-sell')}>{c.total_return_pct >= 0 ? '+' : ''}{c.total_return_pct.toFixed(2)}%</span></span>
              <span>Trades: <span className="text-text-primary font-medium">{c.open_trades ?? 0} open</span> · <span className="text-text-primary font-medium">{c.closed_trades ?? 0} closed</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openTrades(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border-primary text-text-secondary hover:text-text-primary hover:border-accent transition-all"
            >
              Trades
            </button>
            {c.status === 'active' && (
              <button
                type="button"
                onClick={() => openRefill(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-accent hover:text-black disabled:opacity-50 transition-all"
              >
                + Refill
              </button>
            )}
            {(c.copy_type === 'pamm' || c.copy_type === 'mam') ? (
              <button
                type="button"
                disabled={stoppingId === c.id}
                onClick={() => withdrawManaged(c.id, c.provider_name)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-warning text-warning hover:bg-warning hover:text-white disabled:opacity-50 transition-all"
              >
                {stoppingId === c.id ? 'Withdrawing…' : 'Withdraw'}
              </button>
            ) : (
              <button
                type="button"
                disabled={stoppingId === c.id}
                onClick={() => stopCopy(c.id, c.provider_name)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-sell text-sell hover:bg-sell hover:text-white disabled:opacity-50 transition-all"
              >
                {stoppingId === c.id ? 'Stopping…' : 'Stop'}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Copy-trades history modal */}
      {tradesTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setTradesTarget(null)}>
          <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-bg-secondary border border-border-glass">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Copy Trades — {tradesTarget.provider_name}</h3>
                {tradesData && (
                  <p className="text-xxs text-text-tertiary mt-0.5">
                    {tradesData.open_count} open · {tradesData.closed_count} closed
                    {typeof tradesData.your_ratio_pct === 'number' ? ` · your share ${tradesData.your_ratio_pct}%` : ''}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setTradesTarget(null)} className="text-text-tertiary hover:text-text-primary text-lg">✕</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {tradesLoading && <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" /></div>}
              {!tradesLoading && tradesData && (() => {
                const pammShare = tradesData.copy_type === 'pamm';
                const pnlOf = (t: CopyTradeRow) => pammShare ? (t.your_share ?? 0) : (t.pnl ?? 0);
                const rows = [...tradesData.open_trades, ...tradesData.closed_trades];
                if (rows.length === 0) return <EmptyState message="No copy trades yet for this subscription" />;
                return (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-tertiary text-left">
                        <th className="py-1.5 font-medium">Symbol</th>
                        <th className="py-1.5 font-medium">Side</th>
                        <th className="py-1.5 font-medium text-right">Lots</th>
                        <th className="py-1.5 font-medium text-right">Open</th>
                        <th className="py-1.5 font-medium text-right">Close</th>
                        <th className="py-1.5 font-medium text-right">P&amp;L</th>
                        <th className="py-1.5 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((t) => {
                        const pnl = pnlOf(t);
                        return (
                          <tr key={t.id} className="border-t border-border-primary/50">
                            <td className="py-1.5 text-text-primary font-medium">{t.symbol}</td>
                            <td className={clsx('py-1.5 font-medium uppercase', t.side === 'buy' ? 'text-buy' : 'text-sell')}>{t.side}</td>
                            <td className="py-1.5 text-right tabular-nums text-text-secondary">{t.lots}</td>
                            <td className="py-1.5 text-right tabular-nums text-text-secondary">{t.open_price}</td>
                            <td className="py-1.5 text-right tabular-nums text-text-secondary">{t.close_price ?? '—'}</td>
                            <td className={clsx('py-1.5 text-right tabular-nums font-medium', pnl >= 0 ? 'text-buy' : 'text-sell')}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</td>
                            <td className="py-1.5 text-right">
                              <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', t.status === 'open' ? 'bg-buy/20 text-buy' : 'bg-text-tertiary/20 text-text-tertiary')}>
                                {t.status === 'closed' && t.close_reason ? t.close_reason : t.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Refill Modal */}
      {refillTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !refilling && setRefillTarget(null)}>
          <div className="absolute inset-0 bg-bg-base/75 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-2xl bg-bg-secondary border border-border-glass p-6">
            <button type="button" onClick={() => setRefillTarget(null)} disabled={refilling} className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary text-lg">✕</button>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Refill — {refillTarget.provider_name}</h3>
            <p className="text-xxs text-text-tertiary mb-4">Add more funds from your wallet to this investment</p>

            <div className="rounded-lg border border-accent/30 bg-bg-primary p-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Wallet Balance</div>
                <div className="text-lg font-bold text-accent font-mono tabular-nums">${walletBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <button type="button" onClick={() => setRefillAmount(String(walletBal))} className="text-xs font-bold text-accent hover:underline">Max</button>
            </div>

            <div className="rounded-lg border border-border-glass bg-bg-primary p-3 mb-4 text-xs text-text-secondary">
              Current investment: <span className="text-text-primary font-semibold">${refillTarget.allocation_amount.toLocaleString()}</span>
            </div>

            <label className="block text-xs text-text-secondary mb-1">Refill Amount ($)</label>
            <input
              type="number" min="1" step="0.01" value={refillAmount}
              onChange={(e) => setRefillAmount(e.target.value)}
              placeholder="Enter amount"
              className="mb-4 w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent/50 focus:outline-none"
            />

            <div className="flex gap-2">
              <button type="button" onClick={() => setRefillTarget(null)} disabled={refilling}
                className="flex-1 py-2.5 rounded-lg border border-border-glass text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={submitRefill} disabled={refilling || !refillAmount}
                className="flex-1 py-2.5 rounded-lg bg-accent text-black text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-colors">
                {refilling ? 'Adding…' : 'Add Funds'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
function SocialPageInner() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromQuery(searchParams.get('tab')));

  // Aggregate stats for the top 4 cards (DAG mockup). Refetched on mount.
  // Backend returns my-copies list — we sum invested/profit/this-month locally.
  const [copySummary, setCopySummary] = useState({
    totalInvested: 0,
    totalProfit: 0,
    profitThisMonth: 0,
    activeCopies: 0,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ items: Array<{
          allocated_amount?: number; current_value?: number; total_pnl?: number;
          joined_at?: string; status?: string;
        }> }>('/social/my-allocations');
        const items = res.items ?? [];
        const active = items.filter((i) => (i.status || 'active') === 'active');
        const totalInvested = active.reduce((s, i) => s + (Number(i.allocated_amount) || 0), 0);
        const totalProfit = active.reduce((s, i) => s + (Number(i.total_pnl) || 0), 0);
        const now = new Date();
        const thisMonthCutoff = new Date(now.getFullYear(), now.getMonth(), 1);
        const profitThisMonth = active
          .filter((i) => i.joined_at && new Date(i.joined_at) >= thisMonthCutoff)
          .reduce((s, i) => s + (Number(i.total_pnl) || 0), 0);
        if (!cancelled) {
          setCopySummary({
            totalInvested,
            totalProfit,
            profitThisMonth,
            activeCopies: active.length,
          });
        }
      } catch {
        // empty state — stay at zero
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setActiveTab(tabFromQuery(searchParams.get('tab')));
  }, [searchParams]);

  const tabIndex = TABS.findIndex((t) => t.id === activeTab);
  const slideIndex = tabIndex >= 0 ? tabIndex : 0;

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="Trade Master"
          description="Trade Master and becoming a provider require a real trading account. Register a live account to follow top traders or share your strategy."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-10 py-4 sm:py-6">
          {/* Hero — compact on mobile */}
          <section className="relative overflow-hidden rounded-xl border border-border-primary bg-card mb-3 sm:mb-5">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.12] via-transparent to-accent/[0.05]"
              aria-hidden
            />
            <div className="relative z-10 px-3 sm:px-6 py-3 sm:py-8">
              <h1 className="text-base sm:text-3xl font-bold text-text-primary mb-1 sm:mb-2 leading-tight">
                Copy Trading
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary max-w-2xl hidden sm:block">
                Follow top traders and earn by copying their trades. For pooled accounts, use{' '}
                <span className="text-accent font-medium">PAMM</span> in the sidebar.
              </p>
            </div>
          </section>

          {/* ── 4 Stat Cards — clean Vantage style ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-5">
            {/* Total Invested */}
            <div className="rounded-2xl p-4 bg-bg-card border border-border-primary">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
                  <DollarSign size={18} className="text-[#E94E1B]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary font-semibold">Total Invested</p>
                  <p className="text-lg font-bold text-text-primary mt-1 font-mono tabular-nums truncate">
                    ${copySummary.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Total Profit */}
            <div className="rounded-2xl p-4 bg-bg-card border border-border-primary">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
                  <TrendingUp size={18} className="text-[#E94E1B]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary font-semibold">Total Profit</p>
                  <p className="text-lg font-bold text-text-primary mt-1 font-mono tabular-nums truncate">
                    ${copySummary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Profit This Month */}
            <div className="rounded-2xl p-4 bg-bg-card border border-border-primary">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
                  <ArrowDownToLine size={18} className="text-[#E94E1B]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary font-semibold">Profit This Month</p>
                  <p className="text-lg font-bold text-text-primary mt-1 font-mono tabular-nums truncate">
                    ${copySummary.profitThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Copy Trades */}
            <div className="rounded-2xl p-4 bg-bg-card border border-border-primary">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FCE6DD] flex items-center justify-center shrink-0">
                  <Users size={18} className="text-[#E94E1B]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary font-semibold">Active Copy Trades</p>
                  <p className="text-lg font-bold text-text-primary mt-1 font-mono tabular-nums">
                    {copySummary.activeCopies} <span className="text-xs font-medium text-text-tertiary">/ 10</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border-primary bg-card">
            <div className="relative border-b border-border-primary bg-card overflow-x-auto scrollbar-none">
              <div className="flex min-h-[44px] sm:min-h-[52px] min-w-max sm:min-w-0">
                {TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'relative z-10 flex-1 whitespace-nowrap border-0 bg-transparent py-3 sm:py-3.5 px-3 sm:px-4 text-[11px] sm:text-sm font-semibold outline-none',
                        'transition-colors duration-300',
                        active
                          ? 'text-accent border-b-2 border-accent'
                          : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              key={activeTab}
              className="bg-card-nested p-4 md:p-6 animate-wallet-fund-enter-lg min-h-[200px]"
            >
              {activeTab === 'leaderboard' && <LeaderboardTab />}
              {activeTab === 'my-copies' && <MyCopiesTab />}
              {activeTab === 'become-provider' && <BecomeProviderTab />}
              {activeTab === 'my-dashboard' && <MyDashboardTab />}
              {activeTab === 'trade-history' && <CopyTradeHistoryTab />}
            </div>
          </div>

          {/* ── Why Copy Top Traders? ── */}
          <div className="mt-4 sm:mt-6 rounded-2xl bg-bg-card border border-border-primary p-4 sm:p-5">
            <h3 className="text-base font-bold text-text-primary mb-4">Why Copy Top Traders?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: Clock, tile: 'bg-[#FCE6DD]', fg: 'text-[#E94E1B]', title: 'Save Time', desc: 'No need to analyze the market' },
                { icon: GraduationCap, tile: 'bg-[#FCE6DD]', fg: 'text-[#E94E1B]', title: 'Learn & Grow', desc: 'Learn strategies from top traders' },
                { icon: ShieldCheck, tile: 'bg-[#FCE6DD]', fg: 'text-[#E94E1B]', title: 'Risk Management', desc: 'Diversified portfolio with top traders' },
                { icon: BarChart2, tile: 'bg-[#FCE6DD]', fg: 'text-[#E94E1B]', title: 'Transparent Performance', desc: 'Real-time results and performance tracking' },
              ].map((b) => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', b.tile)}>
                    <b.icon size={18} className={b.fg} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary">{b.title}</p>
                    <p className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── How Copy Trading Works? (3-step horizontal flow) ── */}
          <div className="mt-3 sm:mt-4 rounded-2xl bg-bg-card border border-border-primary p-4 sm:p-5">
            <h3 className="text-base font-bold text-text-primary mb-4">How Copy Trading Works?</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
              {[
                { icon: Search, tile: 'bg-[#FCE6DD]', fg: 'text-[#E94E1B]', title: 'Choose a Master', desc: 'Select a top trader' },
                { icon: DollarSign, tile: 'bg-[#FCE6DD]', fg: 'text-[#E94E1B]', title: 'Set Your Amount', desc: 'Invest any amount' },
                { icon: ArrowDownToLine, tile: 'bg-[#FCE6DD]', fg: 'text-[#E94E1B]', title: 'Start Copying', desc: 'We copy trades for you' },
              ].map((s, idx, arr) => (
                <div key={s.title} className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', s.tile)}>
                      <s.icon size={20} className={s.fg} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary">{idx + 1}. {s.title}</p>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                  {idx < arr.length - 1 && (
                    <ArrowRight size={18} className="text-text-tertiary hidden sm:block shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function SocialPage() {
  return (
    <Suspense fallback={null}>
      <SocialPageInner />
    </Suspense>
  );
}


function StrategyInfoCard({ info }: { info: Record<string, string> }) {
  if (!info || Object.keys(info).length === 0) return null;
  const fields = [
    { key: 'strategy_name', label: 'Strategy Name' },
    { key: 'market', label: 'Market' },
    { key: 'risk_profile', label: 'Risk Profile' },
    { key: 'max_drawdown', label: 'Max Drawdown' },
    { key: 'recommended_capital', label: 'Recommended Capital' },
    { key: 'avg_trades', label: 'Avg Trades / Month' },
    { key: 'expected_returns', label: 'Expected Returns' },
  ];
  const riskColor = (r: string) => {
    const v = (r || '').toLowerCase();
    if (v === 'low' || v === 'conservative') return 'text-success bg-success/15';
    if (v === 'moderate') return 'text-warning bg-warning/15';
    return 'text-sell bg-sell/15';
  };
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        </div>
        <span className="text-xs font-semibold text-text-primary">{info.strategy_name || 'Strategy Details'}</span>
      </div>
      {info.description && <p className="text-xxs text-text-secondary leading-relaxed">{info.description}</p>}
      <div className="grid grid-cols-2 gap-2">
        {fields.filter(f => f.key !== 'strategy_name' && info[f.key]).map(f => (
          <div key={f.key} className="p-2 rounded-lg bg-bg-base/60 border border-border-glass">
            <p className="text-[10px] text-text-tertiary mb-0.5">{f.label}</p>
            {f.key === 'risk_profile' ? (
              <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold', riskColor(String(info[f.key] ?? '')))}>{info[f.key]}</span>
            ) : (
              <p className="text-xs font-medium text-text-primary">{info[f.key]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BecomeProviderTab() {
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  // Trade Master section — applies as signal_provider (the master_type that
  // drives copy/mirror trading). PAMM applications live on /pamm.
  const masterType = 'signal_provider';
  const [perfFee, setPerfFee] = useState('20');
  const [minInvest, setMinInvest] = useState('100');
  const [maxInvestors, setMaxInvestors] = useState('100');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Master trading account selection — "new" (admin auto-creates a dedicated
  // CT pool account on approval) vs "existing" (reuse one of the user's
  // live accounts).
  const [accountMode, setAccountMode] = useState<'new' | 'existing'>('new');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; account_number: string; balance: number; is_demo: boolean }>>([]);

  // Strategy Info fields
  const [strategyName, setStrategyName] = useState('');
  const [market, setMarket] = useState('');
  const [riskProfile, setRiskProfile] = useState('Moderate');
  const [maxDrawdown, setMaxDrawdown] = useState('');
  const [recommendedCapital, setRecommendedCapital] = useState('');
  const [avgTrades, setAvgTrades] = useState('');
  const [expectedReturns, setExpectedReturns] = useState('');
  const [strategyDescription, setStrategyDescription] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let provRes = null;
        try { provRes = await api.get<any>('/social/my-provider?master_type=signal_provider'); } catch {}
        if (provRes) setExisting(provRes);
        try {
          const accRes = await api.get<any>('/accounts');
          const items: any[] = Array.isArray(accRes) ? accRes : (accRes?.items ?? []);
          // Only live accounts are eligible — demo accounts can't host
          // master strategies (no real fee chain).
          setAccounts(items.filter((a) => !a.is_demo).map((a) => ({
            id: a.id,
            account_number: a.account_number,
            balance: Number(a.balance) || 0,
            is_demo: !!a.is_demo,
          })));
        } catch {}
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async () => {
    if (accountMode === 'existing' && !selectedAccountId) {
      toast.error('Pick a trading account or switch to "Create new"');
      return;
    }
    setSubmitting(true);
    try {
      const strategyInfo: Record<string, string> = {};
      if (strategyName) strategyInfo.strategy_name = strategyName;
      if (market) strategyInfo.market = market;
      if (riskProfile) strategyInfo.risk_profile = riskProfile;
      if (maxDrawdown) strategyInfo.max_drawdown = maxDrawdown;
      if (recommendedCapital) strategyInfo.recommended_capital = recommendedCapital;
      if (avgTrades) strategyInfo.avg_trades = avgTrades;
      if (expectedReturns) strategyInfo.expected_returns = expectedReturns;
      if (strategyDescription) strategyInfo.description = strategyDescription;

      const params = new URLSearchParams({
        master_type: masterType,
        performance_fee_pct: perfFee,
        min_investment: minInvest,
        max_investors: maxInvestors,
        ...(description ? { description } : {}),
        ...(accountMode === 'existing' && selectedAccountId ? { account_id: selectedAccountId } : {}),
      });
      const res = await api.post<{ account_number?: string }>(
        `/social/become-provider?${params.toString()}`,
        Object.keys(strategyInfo).length > 0 ? strategyInfo : null,
      );
      toast.success(
        res?.account_number
          ? `Application submitted! Master trading account ${res.account_number} created.`
          : 'Application submitted! Admin will review.',
      );
      let refreshed = null;
      try { refreshed = await api.get<any>('/social/my-provider?master_type=signal_provider'); } catch {}
      if (refreshed) setExisting(refreshed);
    } catch (e: unknown) { toast.error(getErrorMessage(e, 'Failed')); } finally { setSubmitting(false); }
  };

  // Re-apply after a rejection. The backend allows a fresh submission once
  // the prior application is 'rejected' (it only blocks pending/approved/
  // active), so we pre-fill the form from the rejected row and drop back to
  // the application form by clearing `existing`.
  const handleReapply = () => {
    if (existing) {
      if (existing.performance_fee_pct != null) setPerfFee(String(existing.performance_fee_pct));
      if (existing.min_investment != null) setMinInvest(String(existing.min_investment));
      if (existing.max_investors != null) setMaxInvestors(String(existing.max_investors));
      if (existing.description) setDescription(existing.description);
      const si = existing.strategy_info || {};
      if (si.strategy_name) setStrategyName(si.strategy_name);
      if (si.market) setMarket(si.market);
      if (si.risk_profile) setRiskProfile(si.risk_profile);
      if (si.max_drawdown) setMaxDrawdown(si.max_drawdown);
      if (si.recommended_capital) setRecommendedCapital(si.recommended_capital);
      if (si.avg_trades) setAvgTrades(si.avg_trades);
      if (si.expected_returns) setExpectedReturns(si.expected_returns);
      if (si.description) setStrategyDescription(si.description);
    }
    setExisting(null);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" /></div>;

  if (existing) {
    const statusColor = existing.status === 'approved' ? 'text-success bg-success/15' : existing.status === 'pending' ? 'text-warning bg-warning/15' : 'text-danger bg-danger/15';
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="glass-card rounded-xl p-5 noise-texture">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Your Provider Application</h3>
            <span className={clsx('px-2 py-0.5 rounded text-xxs font-semibold capitalize', statusColor)}>{existing.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-text-tertiary">Type</p><p className="text-text-primary capitalize">{existing.master_type?.replace('_', ' ')}</p></div>
            <div><p className="text-text-tertiary">Performance Fee</p><p className="text-text-primary">{existing.performance_fee_pct}%</p></div>
            <div><p className="text-text-tertiary">Min Investment</p><p className="text-text-primary font-mono">${existing.min_investment}</p></div>
            <div><p className="text-text-tertiary">Max Investors</p><p className="text-text-primary">{existing.max_investors}</p></div>
            <div><p className="text-text-tertiary">Followers</p><p className="text-text-primary">{existing.followers_count || 0}</p></div>
            <div><p className="text-text-tertiary">Total Trades</p><p className="text-text-primary">{existing.total_trades || 0}</p></div>
          </div>
          {existing.strategy_info && <div className="mt-4"><StrategyInfoCard info={existing.strategy_info} /></div>}
          {existing.status === 'pending' && <p className="text-xxs text-warning mt-3">Your application is under review by the admin team.</p>}
          {existing.status === 'rejected' && (
            <div className="mt-3 space-y-2">
              <p className="text-xxs text-danger">Your application was rejected. You can update your details and re-apply.</p>
              <button
                type="button"
                onClick={handleReapply}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-accent hover:bg-accent/90 active:scale-[0.98] transition-all shadow-lg shadow-accent/25"
              >
                Re-apply
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <MasterEligibilityBanner />
      <div className="glass-card rounded-xl p-5 noise-texture space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Apply to Become a Trade Master</h3>
        <p className="text-xxs text-text-tertiary">Choose your provider type, set your fees, and start earning from followers.</p>

        {/* Provider Type */}
        <div className="p-3 rounded-xl border border-buy/30 bg-buy/5">
          <p className="text-xs font-semibold text-buy">Trade Master</p>
          <p className="text-xxs text-text-tertiary mt-0.5">Individual accounts — your followers automatically mirror your trades in real time (proportional lot size per investor)</p>
        </div>

        <div className="p-3 rounded-xl border border-border-glass bg-bg-secondary text-xxs text-text-tertiary flex items-center justify-between gap-3">
          <span>Want to run a pooled PAMM fund instead?</span>
          <a href="/pamm" className="text-buy underline underline-offset-2 whitespace-nowrap">Apply on PAMM page →</a>
        </div>

        {/* Zero-accounts warning. Followers literally can't mirror anything
            if the applicant has no live account, so block the submission
            with a clear call-to-action instead of silently allowing a
            broken application through. */}
        {accounts.length === 0 && (
          <div className="p-3 rounded-xl border border-warning/40 bg-warning/10 text-xxs text-text-primary">
            <p className="font-semibold text-warning mb-1">No live trading account yet</p>
            <p className="text-text-secondary leading-snug">
              You need at least one live (non-demo) trading account before applying — it&apos;s the account your followers will mirror.
            </p>
            <a href="/accounts" className="inline-block mt-2 text-accent font-semibold hover:underline">
              Open a live account →
            </a>
          </div>
        )}

        {/* Master trading account picker */}
        <div className="p-3 rounded-xl border border-accent/30 bg-accent/5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-accent">Master Trading Account</p>
            <p className="text-xxs text-text-secondary mt-0.5">
              Which account will your followers mirror? Pick a fresh dedicated one, or reuse a live account you already trade well.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              className={clsx(
                'cursor-pointer rounded-lg border p-3 text-xxs transition-colors',
                accountMode === 'new'
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-border-glass bg-bg-secondary hover:border-accent/30',
              )}
            >
              <input
                type="radio"
                name="acct-mode"
                value="new"
                checked={accountMode === 'new'}
                onChange={() => {
                  setAccountMode('new');
                  setSelectedAccountId('');
                }}
                className="sr-only"
              />
              <p className="font-semibold text-text-primary">Create new dedicated account</p>
              <p className="text-text-tertiary mt-0.5 leading-snug">
                A fresh CT account is opened on approval. Keeps your personal trading separate.
              </p>
            </label>
            <label
              className={clsx(
                'cursor-pointer rounded-lg border p-3 text-xxs transition-colors',
                accountMode === 'existing'
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-border-glass bg-bg-secondary hover:border-accent/30',
                accounts.length === 0 && 'opacity-60 cursor-not-allowed',
              )}
            >
              <input
                type="radio"
                name="acct-mode"
                value="existing"
                checked={accountMode === 'existing'}
                disabled={accounts.length === 0}
                onChange={() => setAccountMode('existing')}
                className="sr-only"
              />
              <p className="font-semibold text-text-primary">Use an existing account</p>
              <p className="text-text-tertiary mt-0.5 leading-snug">
                {accounts.length === 0
                  ? 'No live accounts available — open one first.'
                  : 'Make one of your live accounts the master. Followers mirror it from day one.'}
              </p>
            </label>
          </div>
          {accountMode === 'existing' && accounts.length > 0 && (
            <div>
              <label className="text-xxs text-text-secondary block mb-1">Pick the account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono"
              >
                <option value="">— Select —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} · ${a.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-warning mt-1.5 leading-snug">
                Note: every trade you place on this account will be mirrored to followers once approved.
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xxs text-text-secondary block mb-1">Performance Fee %</label>
            <input type="number" min="0" max="50" value={perfFee} onChange={e => setPerfFee(e.target.value)} className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono" />
          </div>
          <div>
            <label className="text-xxs text-text-secondary block mb-1">Min Investment ($)</label>
            <input type="number" min="1" value={minInvest} onChange={e => setMinInvest(e.target.value)} className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono" />
          </div>
        </div>
        <div>
          <label className="text-xxs text-text-secondary block mb-1">Max Investors</label>
          <input type="number" min="1" max="1000" value={maxInvestors} onChange={e => setMaxInvestors(e.target.value)} className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs font-mono" />
        </div>
        <div>
          <label className="text-xxs text-text-secondary block mb-1">Description / Strategy</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe your trading strategy..." className="skeu-input w-full text-text-primary rounded-xl py-2.5 px-4 text-xs resize-none" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || accounts.length === 0}
          className={clsx(
            'w-full py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-accent/25',
            submitting || accounts.length === 0
              ? 'bg-accent/50 cursor-not-allowed shadow-none'
              : 'bg-accent hover:bg-accent/90 active:scale-[0.98]',
          )}
        >
          {accounts.length === 0
            ? 'Open a live account first'
            : submitting
              ? 'Submitting...'
              : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}


function MyDashboardTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  useEffect(() => {
    (async () => {
      let res = null;
      try { res = await api.get<any>('/social/my-provider'); } catch {}
      setData(res);
      setLoading(false);
      if (res && res.status === 'approved') {
        loadFollowers();
      }
    })();
  }, []);

  const loadFollowers = async () => {
    setFollowersLoading(true);
    try {
      const res = await api.get<any>('/followers/my-followers');
      setFollowers(res.followers || []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load followers'));
    } finally {
      setFollowersLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" /></div>;
  if (!data || data.status !== 'approved') return <div className="text-center py-16 text-xs text-text-tertiary">You are not an approved Trade Master. Apply in the &ldquo;Become Trade Master&rdquo; tab.</div>;

  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-5">
      {/* Master badge + name */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-lg font-bold">M</div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary">Master Dashboard</h2>
            <span className="px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[10px] font-bold uppercase tracking-wider">Master</span>
          </div>
          <p className="text-xs text-text-tertiary">Signal Provider · Since {data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div onClick={loadFollowers} className="rounded-xl border border-border-primary bg-bg-secondary p-3 cursor-pointer hover:ring-2 hover:ring-buy/30 transition-all">
          <p className="text-xxs text-text-tertiary">Followers</p>
          <p className="text-xl font-bold font-mono tabular-nums text-buy mt-0.5">{data.followers_count || 0}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Active Investors</p>
          <p className="text-xl font-bold font-mono tabular-nums text-text-primary mt-0.5">{data.active_investors || 0} <span className="text-xs text-text-tertiary font-normal">/ {data.max_investors}</span></p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Total AUM</p>
          <p className="text-xl font-bold font-mono tabular-nums text-success mt-0.5">${fmt(data.total_aum || 0)}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Open Positions</p>
          <p className="text-xl font-bold font-mono tabular-nums text-text-primary mt-0.5">{data.open_positions || 0}</p>
        </div>
      </div>

      {/* Earnings / Profit Sharing Section */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Earnings & Profit Sharing</h3>
          <p className="text-xxs text-text-tertiary mt-0.5">Commission earned from your followers&apos; performance fees</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
          <div>
            <p className="text-xxs text-text-tertiary">Commission Earned</p>
            <p className="text-lg font-bold font-mono tabular-nums text-warning">${fmt(data.commission_earned || 0)}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">From followers</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Commission Paid to Admin</p>
            <p className="text-lg font-bold font-mono tabular-nums text-sell">${fmt(data.admin_commission_paid || 0)}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{data.admin_commission_pct || 0}% of your fee</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Performance Fee Rate</p>
            <p className="text-lg font-bold font-mono text-text-primary">{data.performance_fee_pct}%</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Followers&apos; Total Profit</p>
            <p className={clsx('text-lg font-bold font-mono tabular-nums', (data.total_investor_profit || 0) >= 0 ? 'text-buy' : 'text-sell')}>${fmt(data.total_investor_profit || 0)}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Management Fee</p>
            <p className="text-lg font-bold font-mono text-text-primary">{data.management_fee_pct || 0}%</p>
          </div>
        </div>
      </div>

      {/* Trading Activity */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Trading Activity</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <div>
            <p className="text-xxs text-text-tertiary">Today&apos;s Trades</p>
            <p className="text-lg font-bold font-mono tabular-nums text-text-primary">{data.today_trades || 0}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Today&apos;s Profit</p>
            <p className={clsx('text-lg font-bold font-mono tabular-nums', (data.today_profit || 0) >= 0 ? 'text-buy' : 'text-sell')}>
              {(data.today_profit || 0) >= 0 ? '+' : ''}${fmt(data.today_profit || 0)}
            </p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Total Trades</p>
            <p className="text-lg font-bold font-mono tabular-nums text-text-primary">{data.total_trades || 0}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Win Rate</p>
            <p className={clsx('text-lg font-bold font-mono tabular-nums', (data.win_rate || 0) >= 50 ? 'text-buy' : 'text-sell')}>{data.win_rate?.toFixed(1) || '0.0'}%</p>
          </div>
        </div>
      </div>

      {/* Copy Trades Generated — mirrors spawned across all followers */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Copy Trades</h3>
          <p className="text-xxs text-text-tertiary mt-0.5">Mirrored trades generated across all your followers&apos; accounts</p>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4">
          <div>
            <p className="text-xxs text-text-tertiary">Open</p>
            <p className="text-lg font-bold font-mono tabular-nums text-buy">{data.copy_open_count || 0}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Closed</p>
            <p className="text-lg font-bold font-mono tabular-nums text-text-primary">{data.copy_closed_count || 0}</p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Total</p>
            <p className="text-lg font-bold font-mono tabular-nums text-text-primary">{data.copy_total_count || 0}</p>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary">
          <h3 className="text-sm font-semibold text-text-primary">Performance Stats</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 text-xs">
          <div><p className="text-text-tertiary">Total Return</p><p className={clsx('font-mono font-bold text-base', data.total_return_pct >= 0 ? 'text-buy' : 'text-sell')}>{data.total_return_pct >= 0 ? '+' : ''}{data.total_return_pct?.toFixed(2)}%</p></div>
          <div><p className="text-text-tertiary">Max Drawdown</p><p className="text-sell font-mono font-bold text-base">{data.max_drawdown_pct?.toFixed(2)}%</p></div>
          <div><p className="text-text-tertiary">Sharpe Ratio</p><p className="text-text-primary font-mono font-bold text-base">{data.sharpe_ratio?.toFixed(2)}</p></div>
          <div><p className="text-text-tertiary">Total Profit</p><p className={clsx('font-mono font-bold text-base', data.total_profit >= 0 ? 'text-buy' : 'text-sell')}>${fmt(data.total_profit || 0)}</p></div>
          <div><p className="text-text-tertiary">Min Investment</p><p className="text-text-primary font-mono text-base">${fmt(data.min_investment || 0)}</p></div>
          <div><p className="text-text-tertiary">Status</p><p className="text-success capitalize text-base font-semibold">{data.status}</p></div>
        </div>
      </div>

      {/* My Followers Section */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">My Followers</h3>
            <p className="text-xxs text-text-tertiary mt-0.5">Users currently following your trades</p>
          </div>
          <button
            onClick={loadFollowers}
            disabled={followersLoading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-all disabled:opacity-50"
          >
            {followersLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div className="p-4">
          {followersLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" />
            </div>
          ) : followers.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-tertiary">No followers yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-glass">
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Follower</th>
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">User ID</th>
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Account</th>
                    <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Investment</th>
                    <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Profit/Loss</th>
                    <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">ROI %</th>
                    <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {followers.map((f) => (
                    <tr key={f.id} className="border-b border-border-glass/50 hover:bg-bg-hover/30 transition-colors">
                      <td className="px-3 py-3">
                        <div>
                          <p className="text-xs font-medium text-text-primary">{f.user_name}</p>
                          <p className="text-xxs text-text-tertiary">{f.user_email}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xxs text-accent font-mono font-semibold">{f.user_id}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-text-secondary font-mono">{f.account_number}</td>
                      <td className="px-3 py-3 text-right text-xs font-mono text-text-primary">${f.allocation_amount.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={clsx('text-xs font-mono font-bold', f.total_profit >= 0 ? 'text-buy' : 'text-sell')}>
                          {f.total_profit >= 0 ? '+' : ''}${f.total_profit.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={clsx('text-xs font-mono font-bold', f.profit_pct >= 0 ? 'text-buy' : 'text-sell')}>
                          {f.profit_pct >= 0 ? '+' : ''}{f.profit_pct}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xxs text-text-tertiary">{new Date(f.joined_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History — commissions + withdrawals + transfers */}
      <MasterTransactionHistory />

      {/* Followers Modal */}
      {showFollowers && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-bg-base/75 backdrop-blur-sm p-4" onClick={() => setShowFollowers(false)}>
          <div className="w-full max-w-4xl bg-bg-secondary border border-border-glass rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-glass bg-bg-tertiary/50">
              <h3 className="text-base font-bold text-text-primary">My Followers ({followers.length})</h3>
              <button onClick={() => setShowFollowers(false)} className="p-2 rounded-lg hover:bg-bg-hover transition-colors">
                <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {followersLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-buy border-t-transparent rounded-full animate-spin" />
                </div>
              ) : followers.length === 0 ? (
                <div className="text-center py-12 text-sm text-text-tertiary">No followers yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-glass">
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Follower</th>
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">User ID</th>
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Account</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Investment</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Profit/Loss</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">ROI %</th>
                        <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Copied Trades</th>
                        <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followers.map((f) => (
                        <tr key={f.id} className="border-b border-border-glass/50 hover:bg-bg-hover/30 transition-colors">
                          <td className="px-3 py-3">
                            <div>
                              <p className="text-xs font-medium text-text-primary">{f.user_name}</p>
                              <p className="text-xxs text-text-tertiary">{f.user_email}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-xxs text-text-secondary font-mono">{f.user_id}</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-text-secondary font-mono">{f.account_number}</td>
                          <td className="px-3 py-3 text-right text-xs font-mono text-text-primary">${f.allocation_amount.toLocaleString()}</td>
                          <td className="px-3 py-3 text-right">
                            <span className={clsx('text-xs font-mono font-bold', f.total_profit >= 0 ? 'text-buy' : 'text-sell')}>
                              {f.total_profit >= 0 ? '+' : ''}${f.total_profit.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={clsx('text-xs font-mono font-bold', f.profit_pct >= 0 ? 'text-buy' : 'text-sell')}>
                              {f.profit_pct >= 0 ? '+' : ''}{f.profit_pct}%
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-text-primary font-mono">{f.total_copied_trades}</td>
                          <td className="px-3 py-3 text-xxs text-text-tertiary">{new Date(f.joined_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ─── Trade History Tab — all copy trades across every subscription ─── */
interface CopyHistoryRow {
  id: string;
  allocation_id: string;
  account_key: string;
  account_number: string;
  provider_name: string;
  copy_type: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  pnl: number;
  close_reason?: string | null;
  status: string;
}
interface CopyHistoryAccount {
  account_key: string;
  account_number: string;
  master_name: string;
  copy_type: string;
}
interface CopyHistoryResponse {
  items: CopyHistoryRow[];
  accounts: CopyHistoryAccount[];
  symbols: string[];
  open_count: number;
  closed_count: number;
  total: number;
  total_pnl: number;
}

function CopyTradeHistoryTab() {
  const [data, setData] = useState<CopyHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountKey, setAccountKey] = useState('all');
  const [symbol, setSymbol] = useState('all');
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CopyHistoryResponse>('/social/copy-trade-history');
      setData(res);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load trade history'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Client-side filtering keeps the dropdowns snappy; the response already
  // carries the full account + symbol lists so the filters stay populated
  // even when a narrower view is selected.
  const rows = useMemo(() => {
    const all = data?.items ?? [];
    return all.filter((r) =>
      (accountKey === 'all' || r.account_key === accountKey) &&
      (symbol === 'all' || r.symbol === symbol) &&
      (status === 'all' || r.status === status),
    );
  }, [data, accountKey, symbol, status]);

  const filteredPnl = useMemo(
    () => rows.reduce((s, r) => s + (r.pnl || 0), 0),
    [rows],
  );

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={fetchHistory} />;
  if (!data || data.items.length === 0) {
    return <EmptyState message="No copy trades yet. Once you follow a master and trades mirror in, they'll show up here." />;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Total Trades</p>
          <p className="text-lg font-bold font-mono tabular-nums text-text-primary mt-0.5">{data.total}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Open</p>
          <p className="text-lg font-bold font-mono tabular-nums text-buy mt-0.5">{data.open_count}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Closed</p>
          <p className="text-lg font-bold font-mono tabular-nums text-text-primary mt-0.5">{data.closed_count}</p>
        </div>
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-3">
          <p className="text-xxs text-text-tertiary">Net P&amp;L</p>
          <p className={clsx('text-lg font-bold font-mono tabular-nums mt-0.5', data.total_pnl >= 0 ? 'text-buy' : 'text-sell')}>
            {data.total_pnl >= 0 ? '+' : ''}${fmt(data.total_pnl)}
          </p>
        </div>
      </div>

      {/* Filters: account-wise + trade-wise (symbol) + status */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <label className="text-xxs text-text-tertiary block mb-1">Account</label>
          <select
            value={accountKey}
            onChange={(e) => setAccountKey(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-xs text-text-primary focus:border-accent/50 focus:outline-none"
          >
            <option value="all">All accounts</option>
            {data.accounts.map((a) => (
              <option key={a.account_key} value={a.account_key}>
                {a.account_number} · {a.master_name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="text-xxs text-text-tertiary block mb-1">Instrument</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-xs text-text-primary font-mono focus:border-accent/50 focus:outline-none"
          >
            <option value="all">All instruments</option>
            {data.symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'open', 'closed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={clsx(
                'px-3 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors',
                status === s
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border-primary text-text-secondary hover:text-text-primary',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {(accountKey !== 'all' || symbol !== 'all' || status !== 'all') && (
          <button
            type="button"
            onClick={() => { setAccountKey('all'); setSymbol('all'); setStatus('all'); }}
            className="px-3 py-2 rounded-lg text-xs font-medium text-text-tertiary hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border-primary flex items-center justify-between">
          <p className="text-xs font-semibold text-text-primary">
            {rows.length} trade{rows.length === 1 ? '' : 's'}
          </p>
          <p className={clsx('text-xs font-mono font-bold tabular-nums', filteredPnl >= 0 ? 'text-buy' : 'text-sell')}>
            {filteredPnl >= 0 ? '+' : ''}${fmt(filteredPnl)}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState message="No trades match the selected filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-glass text-text-tertiary text-left">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 font-medium">Master</th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Side</th>
                  <th className="px-3 py-2 font-medium text-right">Lots</th>
                  <th className="px-3 py-2 font-medium text-right">Open</th>
                  <th className="px-3 py-2 font-medium text-right">Close</th>
                  <th className="px-3 py-2 font-medium text-right">P&amp;L</th>
                  <th className="px-3 py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const ts = t.closed_at || t.opened_at;
                  return (
                    <tr key={`${t.status}-${t.id}`} className="border-b border-border-glass/50 hover:bg-bg-hover/30 transition-colors">
                      <td className="px-3 py-2.5 text-xxs text-text-secondary whitespace-nowrap">
                        {ts ? new Date(ts).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-text-primary">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[120px]">{t.provider_name}</span>
                          <span className="px-1 py-0.5 rounded bg-accent/15 text-accent text-[9px] font-bold uppercase shrink-0">{t.copy_type}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary font-mono whitespace-nowrap">{t.account_number}</td>
                      <td className="px-3 py-2.5 text-text-primary font-medium">{t.symbol}</td>
                      <td className={clsx('px-3 py-2.5 font-medium uppercase', t.side === 'buy' ? 'text-buy' : 'text-sell')}>{t.side}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{t.lots}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{t.open_price}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{t.close_price ?? '—'}</td>
                      <td className={clsx('px-3 py-2.5 text-right tabular-nums font-medium', t.pnl >= 0 ? 'text-buy' : 'text-sell')}>
                        {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', t.status === 'open' ? 'bg-buy/20 text-buy' : 'bg-text-tertiary/20 text-text-tertiary')}>
                          {t.status === 'closed' && t.close_reason ? t.close_reason : t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type MasterTxnFollower = { user_id: string; name: string; email: string };
type MasterTxn = {
  id: string;
  created_at: string | null;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  follower: MasterTxnFollower | null;
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  lots: number | null;
  gross_profit: number | null;
  performance_fee_pct: number | null;
  performance_fee_gross: number | null;
  admin_commission_pct: number | null;
  admin_fee: number | null;
  master_net: number | null;
};
type MasterTxnResponse = {
  items: MasterTxn[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
  summary: {
    total_commission: number;
    total_withdrawn: number;
    total_transferred: number;
    total_deposit: number;
  };
};

const TXN_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'commission', label: 'Commission' },
  { id: 'withdrawal', label: 'Withdrawals' },
  { id: 'transfer', label: 'Transfers' },
  { id: 'deposit', label: 'Deposits' },
] as const;

function MasterTransactionHistory() {
  const [filter, setFilter] = useState<(typeof TXN_FILTERS)[number]['id']>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MasterTxnResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const perPage = 15;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get<MasterTxnResponse>('/social/master/transactions', {
          page: String(page),
          per_page: String(perPage),
          filter_type: filter,
        });
        if (alive) setData(res);
      } catch (e) {
        if (alive) toast.error(getErrorMessage(e, 'Failed to load transaction history'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filter, page]);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const typeLabel = (t: string) => {
    switch (t) {
      case 'ib_commission':
        return { text: 'Commission', cls: 'bg-buy/15 text-buy border-buy/30' };
      case 'withdrawal':
        return { text: 'Withdrawal', cls: 'bg-sell/15 text-sell border-sell/30' };
      case 'transfer':
        return { text: 'Transfer', cls: 'bg-accent/15 text-accent border-accent/30' };
      case 'deposit':
        return { text: 'Deposit', cls: 'bg-success/15 text-success border-success/30' };
      case 'bonus':
        return { text: 'Bonus', cls: 'bg-warning/15 text-warning border-warning/30' };
      default:
        return { text: t, cls: 'bg-bg-tertiary text-text-secondary border-border-primary' };
    }
  };

  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary overflow-hidden">
      <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Master Account History</h3>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Activity on your master pool account only — commissions earned per follower, plus any withdrawals or transfers of those earnings. General wallet activity lives in Funds → Transaction History.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TXN_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-colors',
                filter === f.id
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-bg-secondary border-border-primary text-text-secondary hover:bg-bg-hover',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 border-b border-border-primary bg-bg-tertiary/30">
          <div>
            <p className="text-xxs text-text-tertiary">Total Commission</p>
            <p className="text-sm font-bold font-mono tabular-nums text-buy">
              ${fmt(data.summary.total_commission)}
            </p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Total Withdrawn</p>
            <p className="text-sm font-bold font-mono tabular-nums text-sell">
              ${fmt(data.summary.total_withdrawn)}
            </p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Net Transferred</p>
            <p className="text-sm font-bold font-mono tabular-nums text-text-primary">
              {data.summary.total_transferred >= 0 ? '+' : ''}${fmt(data.summary.total_transferred)}
            </p>
          </div>
          <div>
            <p className="text-xxs text-text-tertiary">Total Deposits</p>
            <p className="text-sm font-bold font-mono tabular-nums text-success">
              ${fmt(data.summary.total_deposit)}
            </p>
          </div>
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-buy border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="text-center py-10 text-sm text-text-tertiary">No transactions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-glass">
                  <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Date</th>
                  <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Type</th>
                  <th className="text-left px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Source / Details</th>
                  <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Amount</th>
                  <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase">Balance</th>
                  <th className="text-right px-3 py-2 text-xxs font-semibold text-text-tertiary uppercase w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => {
                  const lbl = typeLabel(t.type);
                  const isExpandable = t.type === 'ib_commission';
                  const isOpen = expanded === t.id;
                  return (
                    <Fragment key={t.id}>
                      <tr
                        className={clsx(
                          'border-b border-border-glass/50 transition-colors',
                          isExpandable ? 'cursor-pointer hover:bg-bg-hover/30' : 'hover:bg-bg-hover/15',
                        )}
                        onClick={() => isExpandable && setExpanded(isOpen ? null : t.id)}
                      >
                        <td className="px-3 py-3 text-xxs text-text-secondary whitespace-nowrap">
                          {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={clsx('px-2 py-0.5 rounded text-[9px] font-bold uppercase border', lbl.cls)}>
                            {lbl.text}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-text-primary">
                          {t.type === 'ib_commission' ? (
                            t.follower ? (
                              <div>
                                <p className="font-medium">{t.follower.name}</p>
                                <p className="text-xxs text-text-tertiary">
                                  {t.symbol ? `${t.symbol} ${t.side?.toUpperCase() ?? ''} ${t.lots ?? ''} lots` : t.follower.email}
                                </p>
                              </div>
                            ) : (
                              <span className="text-text-tertiary">Copy trade</span>
                            )
                          ) : (
                            <span className="text-text-secondary">{t.description || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={clsx(
                              'text-xs font-mono font-bold tabular-nums',
                              t.amount >= 0 ? 'text-buy' : 'text-sell',
                            )}
                          >
                            {t.amount >= 0 ? '+' : ''}${fmt(Math.abs(t.amount))}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-xxs text-text-tertiary font-mono tabular-nums">
                          {t.balance_after != null ? `$${fmt(t.balance_after)}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {isExpandable && (
                            <span
                              className={clsx(
                                'inline-block text-text-tertiary transition-transform',
                                isOpen && 'rotate-180',
                              )}
                            >
                              ▾
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpandable && isOpen && (
                        <tr className="bg-bg-tertiary/40">
                          <td colSpan={6} className="px-3 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xxs">
                              <div>
                                <p className="text-text-tertiary uppercase tracking-wider mb-0.5">Follower P/L (Gross)</p>
                                <p className={clsx('font-mono font-bold text-sm', (t.gross_profit ?? 0) >= 0 ? 'text-buy' : 'text-sell')}>
                                  {(t.gross_profit ?? 0) >= 0 ? '+' : ''}${fmt(t.gross_profit ?? 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-text-tertiary uppercase tracking-wider mb-0.5">Perf Fee {t.performance_fee_pct?.toFixed(0)}%</p>
                                <p className="font-mono font-bold text-sm text-text-primary">
                                  ${fmt(t.performance_fee_gross ?? 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-text-tertiary uppercase tracking-wider mb-0.5">Platform Cut {t.admin_commission_pct?.toFixed(0)}%</p>
                                <p className="font-mono font-bold text-sm text-sell">
                                  −${fmt(t.admin_fee ?? 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-text-tertiary uppercase tracking-wider mb-0.5">You Earned</p>
                                <p className="font-mono font-bold text-sm text-buy">
                                  +${fmt(t.master_net ?? 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-text-tertiary uppercase tracking-wider mb-0.5">Follower ID</p>
                                <p className="font-mono text-text-secondary truncate text-xs">{t.follower?.user_id ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-xxs text-text-tertiary">
              Page {data.page} of {data.pages} · {data.total} entries
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1 || loading}
                className="px-3 py-1 rounded-md text-xxs font-semibold border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={data.page >= data.pages || loading}
                className="px-3 py-1 rounded-md text-xxs font-semibold border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
