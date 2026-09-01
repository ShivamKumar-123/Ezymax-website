'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  Pencil,
  ArrowLeftRight,
  Trash2,
  Settings,
  Wallet,
  ArrowDownToLine,
  TrendingUp,
  Users,
  PieChart,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Button } from '@/components/ui/Button';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useTradingStore, type TradingAccount, type AccountGroupInfo } from '@/stores/tradingStore';
import {
  getPersistedTradingAccountId,
  setPersistedTradingAccountId,
  tradingTerminalUrl,
} from '@/lib/tradingNav';
import Modal from '@/components/ui/Modal';
import BrandCard, { useBrandTone } from '@/components/ui/BrandCard';
import AccountTypePickerModal from '@/components/accounts/AccountTypePickerModal';
import Pagination, { usePagination } from '@/components/ui/Pagination';

const ALIAS_PREFIX = 'ptd-account-alias:';

interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  margin_level: number;
  leverage: number;
  currency: string;
  is_demo: boolean;
  is_wallet_account?: boolean;
  is_copy_trading?: boolean;
  is_active?: boolean;
  account_group?: AccountGroupInfo | null;
  created_at?: string;
}

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function readAlias(id: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(`${ALIAS_PREFIX}${id}`) || '';
  } catch {
    return '';
  }
}

function writeAlias(id: string, value: string) {
  try {
    const v = value.trim();
    if (v) localStorage.setItem(`${ALIAS_PREFIX}${id}`, v);
    else localStorage.removeItem(`${ALIAS_PREFIX}${id}`);
  } catch {
    /* ignore */
  }
}

function toTradingAccount(row: AccountRow): TradingAccount {
  return {
    id: row.id,
    account_number: row.account_number,
    balance: row.balance,
    credit: row.credit,
    equity: row.equity,
    margin_used: row.margin_used,
    free_margin: row.free_margin,
    margin_level: row.margin_level,
    leverage: row.leverage,
    currency: row.currency,
    is_demo: row.is_demo,
    is_wallet_account: Boolean(row.is_wallet_account),
    account_group: row.account_group ?? null,
  };
}

type AccountKindFilter = 'all' | 'live' | 'demo';

export default function AccountsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setStoreAccounts = useTradingStore((s) => s.setAccounts);
  const setActiveAccount = useTradingStore((s) => s.setActiveAccount);
  const removeAccount = useTradingStore((s) => s.removeAccount);

  /* New filter state for the Vantage-style header row. */
  const [kindFilter, setKindFilter] = useState<AccountKindFilter>('live');
  const [groupFilter, setGroupFilter] = useState<string>('all'); // 'all' or AccountGroupInfo.id
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [demoUpgradeOpen, setDemoUpgradeOpen] = useState(false);
  /** After creating an account, open-account sets sessionStorage; expand that card on Accounts. */
  const [expandAccountId, setExpandAccountId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async (signal?: AbortSignal, opts: { silent?: boolean } = {}) => {
    const id = ++loadGen.current;
    if (!opts.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.get<any>('/accounts', undefined, { signal });
      if (id !== loadGen.current) return;
      const list: AccountRow[] = Array.isArray(res) ? res : (res?.items ?? []);
      setRows(list);
      const tradingList = list.map(toTradingAccount);
      setStoreAccounts(tradingList);
    } catch (e) {
      if (id !== loadGen.current) return;
      // Silent polls swallow errors so a transient blip doesn't surface
      // a toast every 2s; the initial-load handler still shows them.
      if (opts.silent) return;
      const msg = e instanceof Error ? e.message : 'Failed to load accounts';
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === loadGen.current && !opts.silent) setLoading(false);
    }
  }, [setStoreAccounts]);

  useEffect(() => {
    document.documentElement.setAttribute('data-page', 'accounts');
    return () => {
      document.documentElement.removeAttribute('data-page');
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void fetchAccounts(ac.signal);
    return () => {
      ac.abort();
      loadGen.current += 1;
    };
  }, [fetchAccounts]);

  // Live equity / P&L polling. The backend recomputes equity on every
  // /accounts request using current Redis tick prices + open positions
  // (see account_service.list_accounts), so a 2 s poll keeps the P&L
  // column moving without any extra WebSocket plumbing. Polling pauses
  // while the tab is hidden so we don't burn requests for nothing.
  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchAccounts(undefined, { silent: true });
    };

    const interval = setInterval(tick, 2000);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [fetchAccounts]);

  useEffect(() => {
    if (loading || rows.length === 0) return;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem('ptd-accounts-expand');
    } catch {
      /* ignore */
    }
    if (!id) return;
    if (!rows.some((r) => r.id === id)) return;
    setExpandAccountId(id);
    try {
      sessionStorage.removeItem('ptd-accounts-expand');
    } catch {
      /* ignore */
    }
  }, [loading, rows]);

  useEffect(() => {
    if (!expandAccountId) return;
    const el = document.getElementById(`account-card-${expandAccountId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expandAccountId]);

  /* Show all active accounts. CF/IF (follower copy-trade / managed sub-accounts)
     render with "View Trades" instead of Trade — the copy engine places trades
     there automatically. Pool accounts (CT/PM/MM) shown for master funding.
     Inactive accounts are hidden via is_active (delete_master sets this false). */
  const visibleRows = useMemo(() => {
    if (user?.is_demo) return rows.filter((a) => a.is_demo);
    return rows.filter((a) => {
      if ((a as { is_active?: boolean }).is_active === false) return false;
      /* Live/Demo filter — 'all' passes both through; 'live' hides demo;
         'demo' hides live. */
      if (kindFilter === 'live' && a.is_demo) return false;
      if (kindFilter === 'demo' && !a.is_demo) return false;
      /* Account-group filter — 'all' or a specific group id. */
      if (groupFilter !== 'all' && a.account_group?.id !== groupFilter) return false;
      return true;
    });
  }, [rows, user?.is_demo, kindFilter, groupFilter]);
  const rowPager = usePagination(visibleRows, 6);

  /* Distinct account groups present in the loaded data — drives the
     "All" dropdown. Only populated when group data is on the rows. */
  const availableGroups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const g = r.account_group;
      if (g && g.id && !seen.has(g.id)) seen.set(g.id, g.name || 'Standard');
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  /** Sync store + session before opening terminal (navigation via `<Link href>` so clicks always work). */
  const prepareTradeSession = (row: AccountRow) => {
    setActiveAccount(toTradingAccount(row));
    setPersistedTradingAccountId(row.id);
  };

  const handleAccountRemoved = (id: string) => {
    removeAccount(id);
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      setStoreAccounts(next.map(toTradingAccount));
      return next;
    });
    if (getPersistedTradingAccountId() === id) setPersistedTradingAccountId(null);
  };


  /** Live account creation no longer gates on KYC — the only KYC gate left is
   *  on Razorpay (Card / UPI) deposits. Everything else (open account, trade,
   *  manual / crypto deposits, withdrawals) is unblocked. */
  const handleOpenNewAccount = () => {
    setAccountPickerOpen(true);
  };

  return (
    <DashboardShell>
      <AccountTypePickerModal
        open={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        onCreated={() => void fetchAccounts()}
      />
      <Modal
        open={demoUpgradeOpen}
        onClose={() => setDemoUpgradeOpen(false)}
        title="Register a real account"
        width="md"
        className="border border-border-primary bg-bg-card shadow-2xl"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-text-secondary leading-relaxed">
            Demo accounts are provisioned by our team and cannot add new trading accounts. To open additional accounts, please register a real account.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border-primary">
            <button
              type="button"
              onClick={() => setDemoUpgradeOpen(false)}
              className="px-5 py-2.5 rounded-lg border border-border-primary bg-bg-card text-sm font-semibold text-text-primary hover:bg-bg-hover transition-colors"
            >
              Close
            </button>
            <Link
              href="/auth/register"
              onClick={() => setDemoUpgradeOpen(false)}
              className="px-5 py-2.5 rounded-lg bg-[#E94E1B] text-white text-sm font-bold hover:bg-[#C73E11] transition-colors text-center"
            >
              Register Real Account
            </Link>
          </div>
        </div>
      </Modal>
      <div className="page-main w-full space-y-6">
        <div className="animate-wallet-fund-enter-lg">
          <div className="space-y-5">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Accounts</h1>

              {/* Filter / action bar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Live/Demo + account-group filters only make sense for a
                    registered user who can hold real accounts across tiers.
                    A demo (try-with-demo) user has exactly one demo account,
                    so the filters are hidden — they'd only show confusing
                    'Live Account' / 'Standard' options that don't apply. */}
                {!user?.is_demo && (
                  <>
                    <FilterDropdown
                      label={
                        kindFilter === 'all'
                          ? 'All Accounts'
                          : kindFilter === 'live'
                            ? 'Live Account'
                            : 'Demo Account'
                      }
                      options={[
                        { id: 'all', label: 'All Accounts' },
                        { id: 'live', label: 'Live Account' },
                        { id: 'demo', label: 'Demo Account' },
                      ]}
                      value={kindFilter}
                      onChange={(v) => setKindFilter(v as AccountKindFilter)}
                    />
                    {availableGroups.length > 0 && (
                      <FilterDropdown
                        label={
                          groupFilter === 'all'
                            ? 'All'
                            : availableGroups.find((g) => g.id === groupFilter)?.name || 'All'
                        }
                        options={[
                          { id: 'all', label: 'All' },
                          ...availableGroups.map((g) => ({ id: g.id, label: g.name })),
                        ]}
                        value={groupFilter}
                        onChange={setGroupFilter}
                      />
                    )}
                  </>
                )}
                <div className="flex-1" />

                {/* Overall portfolio — every account combined (equity, P&L,
                    journal, trade history). Per-account views live on each card. */}
                <Link
                  href="/portfolio"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-primary bg-crx-pill px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <PieChart size={15} />
                  Overall portfolio
                </Link>

                {/* Open Account — solid black pill that opens AccountTypePickerModal */}
                {user?.is_demo ? (
                  <button
                    type="button"
                    onClick={() => setDemoUpgradeOpen(true)}
                    className="inline-flex items-center justify-center rounded-full bg-crx-charcoal px-5 py-2 text-sm font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover transition-colors"
                  >
                    Open Account
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenNewAccount}
                    className="inline-flex items-center justify-center rounded-full bg-crx-charcoal px-5 py-2 text-sm font-semibold text-crx-charcoal-ink hover:bg-crx-charcoal-hover transition-colors"
                  >
                    Open Account
                  </button>
                )}


              </div>

              {loading && (
                <div className="flex flex-col items-center gap-3 py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-sm text-text-secondary">Loading accounts…</span>
                </div>
              )}

              {!loading && error && (
                <div className="space-y-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-center">
                  <p className="text-sm text-red-400">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => void fetchAccounts()}>
                    Retry
                  </Button>
                </div>
              )}

              {!loading && !error && visibleRows.length === 0 && (
                <div className="rounded-2xl border border-border-primary bg-bg-card p-8 text-center">
                  <p className="text-sm text-text-secondary">
                    {user?.is_demo
                      ? 'No demo trading account is linked yet.'
                      : 'You do not have a trading account yet. Use the "Open Account" button above to open one.'}
                  </p>
                </div>
              )}

              {!loading && !error && visibleRows.length > 0 && (
                <div
                  className={clsx(
                    'grid gap-5',
                    'grid-cols-1 md:grid-cols-2',
                  )}
                >
                  {rowPager.items.map((row) => (
                    <AccountCard
                      key={row.id}
                      row={row}
                      onDeposit={() => router.push(`/wallet?tab=transfer&account=${row.id}`)}
                      onTransfer={() => router.push('/wallet?tab=transfer')}
                      onTrade={() => {
                        prepareTradeSession(row);
                        router.push(tradingTerminalUrl(row.id, { view: 'chart' }));
                      }}
                      onRemoved={handleAccountRemoved}
                    />
                  ))}

                  {/* Build-with-AI card — full width across the grid */}
                  <BuildStrategyCard onStart={() => router.push('/ai-strategies/new')} />
                </div>
              )}
              <Pagination {...rowPager.props} pageSizes={[6, 12, 24]} itemLabel="accounts" />
            </div>
          </div>
      </div>
    </DashboardShell>
  );
}

/* ----------------------------------------------------------------------------
   Small white-pill filter dropdown used in the Accounts toolbar.
   Renders a native <select> overlaid on a styled button so the click target
   matches the rest of the bar but accessibility / keyboard nav stays intact.
   ------------------------------------------------------------------------ */
function FilterDropdown({
  label,
  options,
  value,
  onChange,
  disabled,
  title,
}: {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block" title={title}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          'inline-flex items-center gap-2 rounded-full border border-border-primary bg-bg-card px-4 py-2 text-sm font-medium text-text-primary hover:border-text-tertiary transition-colors',
          disabled && 'opacity-60 cursor-not-allowed hover:border-border-primary',
        )}
      >
        <span>{label}</span>
        <ChevronDown size={14} className={clsx('text-text-tertiary transition-transform', open && 'rotate-180')} />
      </button>
      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-border-primary bg-bg-card shadow-lg ring-1 ring-black/5"
        >
          {options.map((o) => {
            const selected = o.id === value;
            return (
              <li key={o.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    'block w-full px-4 py-2 text-left text-sm hover:bg-bg-input transition-colors',
                    selected ? 'bg-bg-input font-semibold text-text-primary' : 'text-text-primary',
                  )}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   "Build your strategy with AI" card — spans both columns at md+. Dual-tone
   (Vantablack shell, orange accents) with the Claude mark; routes to the
   AI Strategy Maker. Replaces the old Join-Copy-Trading promo.
   ------------------------------------------------------------------------ */
function ClaudeMark({ className }: { className?: string }) {
  // Stylised Claude starburst mark (12 rounded spokes).
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x={22}
          y={4}
          width={4}
          height={15}
          rx={2}
          fill="currentColor"
          transform={`rotate(${i * 30} 24 24)`}
        />
      ))}
    </svg>
  );
}

function BuildStrategyCard({ onStart }: { onStart: () => void }) {
  const t = useBrandTone();
  return (
    <div
      className={clsx(
        'md:col-span-2 relative overflow-hidden rounded-[24px] p-6',
        t.dark
          ? 'bg-black text-white ring-1 ring-white/10 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.9)]'
          : 'bg-white text-text-primary ring-1 ring-black/[0.06] shadow-[0_14px_36px_-18px_rgba(0,0,0,0.22)]',
      )}
    >
      {/* soft orange glow behind the mark */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#E94E1B]/25 blur-3xl"
      />
      <div className="relative z-[1] flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E94E1B] text-white">
            <ClaudeMark className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight">Build your strategy with AI</h3>
              <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', t.dark ? 'bg-white/10 text-white/80' : 'bg-[#E94E1B]/10 text-[#C73E11]')}>
                <ClaudeMark className={clsx('h-3 w-3', t.dark ? 'text-[#F7A17F]' : 'text-[#E94E1B]')} /> Powered by Claude
              </span>
            </div>
            <p className={clsx('mt-1.5 max-w-xl text-sm leading-relaxed', t.muted)}>
              Describe a strategy in plain language — get rules you can inspect, backtest on real data,
              and deploy to any of your accounts in minutes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#E94E1B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#C73E11] transition-colors"
        >
          Build with AI
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   AccountCard � Vantage-style compact card.
   White outer surface, light-gray inner summary tile, "--" placeholder where
   the rich numeric panel used to live. Real balance / credit values are still
   passed through so we can render them in the subline when the data lands.
   ------------------------------------------------------------------------ */
function AccountCard({
  row,
  onDeposit,
  onTransfer,
  onTrade,
  onRemoved,
}: {
  row: AccountRow;
  onDeposit: () => void;
  onTransfer: () => void;
  onTrade: () => void;
  onRemoved: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  /* `alias` is the persisted label shown on the card; `aliasDraft` is the
     in-flight edit inside the rename modal. Keeping them separate lets us
     update the card immediately on save without re-fetching from storage. */
  const [alias, setAlias] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* Close the settings menu on outside-click. */
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const saved = readAlias(row.id);
    setAlias(saved);
    setAliasDraft(saved);
  }, [row.id]);

  const isActive = row.is_active !== false;
  // Copy-trading accounts get the "Copy Trading" tag. True when the backend
  // flags it (any master account — including an existing account picked at
  // apply time — or an active follower account) OR the account-number prefix
  // is a known copy/pool prefix (CF/IF followers, CT/PM/MM pools).
  const isManagedAccount = !!row.is_copy_trading || /^(CF|IF|CT|PM|MM)/.test(row.account_number);
  const groupName = row.account_group?.name?.trim() || 'Standard';
  /* SwissCresta has a single server — Live for real, Demo for demo accounts. */
  const serverLabel = row.is_demo ? 'SwissCresta-Demo' : 'SwissCresta-Live';
  /* Avatar mark — first letter of the group name; falls back to "S". */

  const balance = Number.isFinite(row.balance) ? row.balance : 0;
  const credit = Number.isFinite(row.credit) ? row.credit : 0;
  const hasNumbers = balance > 0 || credit > 0;

  const confirmCloseAccount = async () => {
    setDeleting(true);
    try {
      await api.delete(`/accounts/${row.id}`);
      toast.success(row.is_demo ? 'Demo account removed.' : 'Account closed.');
      setCloseModal(false);
      onRemoved(row.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not close account');
    } finally {
      setDeleting(false);
    }
  };

  const saveAlias = () => {
    const next = aliasDraft.trim();
    writeAlias(row.id, next);
    setAlias(next);
    setRenameOpen(false);
    toast.success(next ? 'Label updated' : 'Label cleared');
  };

  const t = useBrandTone();
  const header = (
    <>
      {/* Header — status pill + platform + account number + settings cog */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={clsx(
              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
              isActive ? t.pill : t.pillQuiet,
            )}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
          {isManagedAccount && (
            <span
              className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', t.pill)}
              title="Copy-trading account — trades are mirrored from the master you follow"
            >
              <Users size={12} />
              Copy Trading
            </span>
          )}
          {alias ? (
            <div className="min-w-0 flex flex-col leading-tight">
              <span className={clsx('truncate text-sm font-semibold', t.text)} title={alias}>
                {alias}
              </span>
              <span className={clsx('text-[11px] tabular-nums', t.muted)}>
                {row.account_number}
              </span>
            </div>
          ) : (
            <span className={clsx('text-sm font-semibold tabular-nums', t.text)}>
              {row.account_number}
            </span>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account settings"
            className={clsx('rounded-full p-1.5 transition-colors', t.iconBtn)}
          >
            <Settings size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-border-primary bg-bg-card py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setRenameOpen(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-hover"
              >
                <Pencil size={14} />
                Rename label
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onTransfer(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-hover"
              >
                <ArrowLeftRight size={14} />
                Transfer funds
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setCloseModal(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Close account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-header � copy-trading accounts show just "Copy Trading"; regular
          accounts show their group + server line. */}
      <p className={clsx('mt-1 text-xs', t.muted)}>
        {isManagedAccount ? (
          <span className={clsx('font-medium', t.text)}>Copy Trading</span>
        ) : (
          <>
            {groupName} STP <span className={clsx('mx-2', t.faint)}>|</span> {serverLabel}
          </>
        )}
      </p>
    </>
  );

  return (
    <BrandCard id={`account-card-${row.id}`} header={header}>
      {/* Inner summary tile */}
      <div>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E94E1B]">
            <Wallet size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={clsx('text-[11px] uppercase tracking-wide font-semibold', t.tileMuted)}>Equity</p>
            <p className={clsx('truncate text-xl font-bold font-mono tabular-nums', t.tileText)}>
              {hasNumbers ? fmt(balance, row.currency) : '--'}
            </p>
            <p className={clsx('mt-0.5 text-xs', t.tileMuted)}>
              Credits: {hasNumbers ? fmt(credit, row.currency) : '-'}
              <span className={clsx('mx-2', t.tileFaint)}>|</span>
              Balance: {hasNumbers ? fmt(balance, row.currency) : '-'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {/* Demo accounts run on play money — deposit doesn't apply, so
              the button is hidden on demo cards. Live cards keep it. */}
          {!row.is_demo && (
            <button
              type="button"
              onClick={onDeposit}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#E94E1B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#C73E11] transition-colors"
            >
              <ArrowDownToLine size={15} />
              Deposit
            </button>
          )}
          <button
            type="button"
            onClick={onTrade}
            title={
              isManagedAccount
                ? 'Managed account — trades are mirrored from the master. Open the terminal to view the copied positions.'
                : undefined
            }
            className={clsx('inline-flex items-center justify-center gap-1.5 rounded-full bg-transparent px-4 py-2 text-sm font-semibold transition-colors', t.outlineBtn)}
          >
            <TrendingUp size={15} />
            {isManagedAccount ? 'View Trades' : 'Trade'}
          </button>
          <Link
            href={`/portfolio?account_id=${row.id}&account_no=${encodeURIComponent(row.account_number)}`}
            title="Portfolio — equity curve, holdings and trade history for this account"
            className={clsx('inline-flex items-center justify-center gap-1.5 rounded-full bg-transparent px-4 py-2 text-sm font-semibold transition-colors', t.outlineBtn)}
          >
            <PieChart size={15} />
            Portfolio
          </Link>
        </div>
      </div>

      {/* Close-account confirmation */}
      <Modal open={closeModal} onClose={() => !deleting && setCloseModal(false)} title="Close account">
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Close account <span className="font-mono font-semibold">{row.account_number}</span>?
          </p>
          <ul className="text-xs text-text-tertiary space-y-1 pl-4 list-disc">
            <li>Any open positions will close at their open price (zero P&amp;L).</li>
            <li>Pending orders will be cancelled.</li>
            {balance > 0 ? (
              <li>
                <span className="text-text-secondary font-semibold">{fmt(balance, row.currency)}</span> will transfer to your main wallet.
              </li>
            ) : null}
          </ul>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={() => setCloseModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={() => void confirmCloseAccount()}
            >
              {deleting ? 'Closing�' : 'Close account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename-label modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename account label">
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Set a friendly label for account{' '}
            <span className="font-mono font-semibold">{row.account_number}</span>. Labels are stored
            locally on this device.
          </p>
          <input
            value={aliasDraft}
            onChange={(e) => setAliasDraft(e.target.value)}
            placeholder="e.g. Main trading"
            className="w-full rounded-xl border border-border-primary bg-bg-input px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent/40"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={saveAlias}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </BrandCard>
  );
}

