'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  RefreshCcw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Shield,
  History,
  DollarSign,
  Hourglass,
} from 'lucide-react';
import {
  type Transaction,
  type WalletLedgerItem,
  type WalletListItem,
  mergeWalletHistory,
  transactionMatchesTypeFilter,
  transactionTitle,
  PAGE_SIZES,
} from '@/lib/wallet/transactionHistoryModel';

interface WalletSummaryResponse {
  main_wallet_balance?: number;
  total_deposited?: number;
  total_withdrawn?: number;
  currency?: string;
}

export default function TransactionsPage() {
  const [currency, setCurrency] = useState('USD');
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'deposit' | 'withdrawal' | 'transfer' | 'trading' | 'adjustment' | 'commission'
  >('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const loadGen = useRef(0);

  const fetchData = useCallback(async (isRefresh = false) => {
    const id = ++loadGen.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const [summaryRes, depRes, wdRes, ledgerRes] = await Promise.allSettled([
        api.get<WalletSummaryResponse>('/wallet/summary'),
        api.get<{ items?: WalletListItem[] }>('/wallet/deposits'),
        api.get<{ items?: WalletListItem[] }>('/wallet/withdrawals'),
        api.get<{ items?: WalletLedgerItem[] }>('/wallet/transactions'),
      ]);
      if (id !== loadGen.current) return;

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const s = summaryRes.value;
        setCurrency(s.currency || 'USD');
        setTotalDeposited(Number(s.total_deposited) || 0);
        setTotalWithdrawn(Number(s.total_withdrawn) || 0);
      }

      if (summaryRes.status === 'rejected') {
        const msg =
          summaryRes.reason instanceof Error ? summaryRes.reason.message : 'Failed to load summary';
        setLoadError(msg);
        toast.error(msg);
      }

      const depItems = depRes.status === 'fulfilled' ? depRes.value?.items || [] : [];
      const wdItems = wdRes.status === 'fulfilled' ? wdRes.value?.items || [] : [];
      const ledgerItems = ledgerRes.status === 'fulfilled' ? ledgerRes.value?.items || [] : [];

      if (depRes.status === 'rejected' || wdRes.status === 'rejected' || ledgerRes.status === 'rejected') {
        toast.error('Some transaction data could not be loaded.');
      }

      setTransactions(mergeWalletHistory(depItems, wdItems, ledgerItems));
    } catch (e) {
      if (id !== loadGen.current) return;
      const message = e instanceof Error ? e.message : 'Failed to load';
      setLoadError(message);
      toast.error(message);
      setTransactions([]);
    } finally {
      if (id === loadGen.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

  const filteredTx = transactions.filter((tx) => {
    if (!transactionMatchesTypeFilter(tx, typeFilter)) return false;
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (new Date(tx.created_at) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(tx.created_at) > to) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTx.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedTx = filteredTx.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pendingTxCount = transactions.filter((t) => t.status === 'pending').length;

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTypeFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  if (loading) {
    return (
      <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-secondary">Loading transactions…</span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="p-0 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 space-y-5 sm:space-y-6">
          <section className="relative overflow-hidden rounded-xl border border-border-primary bg-card">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.12] via-transparent to-accent/[0.05]"
              aria-hidden
            />
            <div className="relative z-10 px-4 sm:px-6 py-5 sm:py-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-text-primary flex items-center gap-2 tracking-tight">
                  <History className="w-7 h-7 text-accent shrink-0" strokeWidth={2} />
                  Transaction History
                </h1>
                <p className="text-text-secondary text-xs sm:text-sm mt-1 max-w-2xl">
                  Deposits, withdrawals, transfers, commissions, and ledger activity in one place.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchData(true)}
                disabled={refreshing}
                className={clsx(
                  'shrink-0 p-2.5 rounded-xl border border-border-primary bg-bg-secondary text-text-secondary hover:text-accent hover:border-accent/40 transition-all',
                  refreshing && 'opacity-60',
                )}
                aria-label="Refresh"
              >
                <RefreshCcw className={clsx('w-5 h-5', refreshing && 'animate-spin')} />
              </button>
            </div>
          </section>

          {loadError && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-text-primary">
              {loadError}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="rounded-xl border border-border-primary bg-card p-4 relative overflow-hidden noise-texture">
              <div className="flex items-center gap-2 text-accent text-[10px] font-bold uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5" />
                Total Deposits
              </div>
              <p className="text-lg md:text-2xl font-bold font-mono text-text-primary tabular-nums mt-2">
                {fmt(totalDeposited)}
              </p>
              <div className="absolute top-0 right-0 w-14 h-14 bg-accent/5 rounded-bl-full pointer-events-none" />
            </div>
            <div className="rounded-xl border border-border-primary bg-card p-4 relative overflow-hidden noise-texture">
              <div className="flex items-center gap-2 text-sell text-[10px] font-bold uppercase tracking-wider">
                <TrendingDown className="w-3.5 h-3.5" />
                Total Withdrawals
              </div>
              <p className="text-lg md:text-2xl font-bold font-mono text-text-primary tabular-nums mt-2">
                {fmt(totalWithdrawn)}
              </p>
              <div className="absolute top-0 right-0 w-14 h-14 bg-sell/5 rounded-bl-full pointer-events-none" />
            </div>
            <div className="rounded-xl border border-border-primary bg-card p-4 relative overflow-hidden noise-texture">
              <div className="flex items-center gap-2 text-accent text-[10px] font-bold uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5" />
                Affiliate Commissions
              </div>
              <p className="text-lg md:text-2xl font-bold font-mono text-text-primary tabular-nums mt-2">
                {fmt(0)}
              </p>
              <p className="text-[10px] text-text-tertiary mt-1">IB payouts when enabled</p>
            </div>
            <div className="rounded-xl border border-border-primary bg-card p-4 relative overflow-hidden noise-texture">
              <div className="flex items-center gap-2 text-warning text-[10px] font-bold uppercase tracking-wider">
                <Hourglass className="w-3.5 h-3.5" />
                Pending
              </div>
              <p className="text-lg md:text-2xl font-bold font-mono text-text-primary tabular-nums mt-2">
                {pendingTxCount}
              </p>
              <p className="text-[10px] text-text-tertiary mt-1">Awaiting approval / processing</p>
            </div>
          </div>

          <div className="rounded-xl border border-border-primary bg-card overflow-hidden noise-texture">
            <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between bg-card-nested/50">
              <h2 className="text-sm font-bold text-text-primary">Transactions</h2>
              <span className="text-xs text-text-tertiary">
                {filteredTx.length} record{filteredTx.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="p-3 md:p-5 space-y-4 bg-card-nested">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border-primary bg-bg-secondary text-text-primary text-xs outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border-primary bg-bg-secondary text-text-primary text-xs outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3 text-text-tertiary" />
                </div>
                {(
                  [
                    ['all', 'All'],
                    ['deposit', 'Deposits'],
                    ['withdrawal', 'Withdrawals'],
                    ['transfer', 'Transfers'],
                    ['commission', 'Commissions'],
                    ['trading', 'Trading P&L'],
                    ['adjustment', 'Adjustments'],
                  ] as const
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTypeFilter(t);
                      setPage(1);
                    }}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
                      typeFilter === t
                        ? 'bg-accent text-black border-accent shadow-[0_0_16px_rgba(0,230,118,0.2)]'
                        : 'border-border-primary bg-bg-secondary text-text-secondary hover:border-accent/35 hover:text-text-primary',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <div className="w-px bg-border-primary mx-1 self-stretch min-h-[1.75rem]" />
                {(['all', 'completed', 'pending', 'failed'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
                      statusFilter === s
                        ? s === 'completed'
                          ? 'bg-buy/20 text-buy border-buy/40'
                          : s === 'pending'
                            ? 'bg-warning/20 text-warning border-warning/40'
                            : s === 'failed'
                              ? 'bg-sell/20 text-sell border-sell/40'
                              : 'bg-accent/15 text-accent border-accent/40'
                        : 'border-border-primary bg-bg-secondary text-text-secondary hover:border-accent/35',
                    )}
                  >
                    {s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
                {(dateFrom || dateTo || typeFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full border border-sell/40 text-sell hover:bg-sell/10 ml-auto"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="px-3 md:px-5 pb-5 space-y-2">
              {!pagedTx.length ? (
                <div className="rounded-xl border border-dashed border-border-primary bg-bg-secondary/30 py-14 text-center">
                  <Clock className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
                  <p className="text-text-secondary text-sm">
                    {filteredTx.length === 0 && transactions.length > 0
                      ? 'No transactions match your filters'
                      : 'No transactions yet. Your history will appear here.'}
                  </p>
                  <Link
                    href="/wallet"
                    className="inline-block mt-4 text-sm font-semibold text-accent hover:underline"
                  >
                    Go to Deposit / Withdraw
                  </Link>
                </div>
              ) : (
                pagedTx.map((tx) => {
                  const signed = tx.signedAmount;
                  const isIn = signed >= 0;
                  const iconWrap = clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-border-primary',
                    tx.type === 'deposit' && 'bg-buy/15 text-buy',
                    tx.type === 'withdrawal' && 'bg-sell/15 text-sell',
                    tx.type === 'transfer' && 'bg-accent/10 text-accent',
                    (tx.type === 'profit' || tx.type === 'credit' || tx.type === 'bonus') &&
                      'bg-buy/15 text-buy',
                    (tx.type === 'loss' || tx.type === 'correction') && 'bg-sell/15 text-sell',
                    tx.type === 'adjustment' && 'bg-bg-tertiary/40 text-text-secondary',
                  );
                  return (
                    <div
                      key={tx.id}
                      className="rounded-xl border border-border-primary bg-bg-secondary/80 p-3 md:p-4 flex items-center gap-3 hover:border-accent/20 transition-colors"
                    >
                      <div className={iconWrap}>
                        {tx.type === 'deposit' ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : tx.type === 'withdrawal' ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : tx.type === 'transfer' ? (
                          <ArrowLeftRight className="w-5 h-5" />
                        ) : tx.type === 'profit' || tx.type === 'credit' || tx.type === 'bonus' ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : tx.type === 'loss' || tx.type === 'correction' ? (
                          <TrendingDown className="w-5 h-5" />
                        ) : (
                          <Shield className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-text-primary font-semibold text-sm truncate">
                              {transactionTitle(tx)}{' '}
                              <span className="text-text-tertiary font-normal text-xs">· {tx.method}</span>
                            </h3>
                            {tx.description ? (
                              <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2">{tx.description}</p>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={clsx(
                                'text-sm font-bold font-mono tabular-nums',
                                isIn ? 'text-buy' : 'text-sell',
                              )}
                            >
                              {isIn ? '+' : '-'}
                              {fmt(Math.abs(signed))}
                            </p>
                            <p
                              className={clsx(
                                'text-[9px] font-bold uppercase tracking-wide mt-1 inline-block px-1.5 py-0.5 rounded border',
                                tx.status === 'completed' && 'bg-buy/15 text-buy border-buy/30',
                                tx.status === 'pending' && 'bg-warning/15 text-warning border-warning/30',
                                tx.status === 'failed' && 'bg-sell/15 text-sell border-sell/30',
                                tx.status === 'cancelled' && 'bg-bg-tertiary/50 text-text-tertiary border-border-primary',
                              )}
                            >
                              {tx.status}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-text-tertiary mt-1">
                          {new Date(tx.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {filteredTx.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border-primary bg-card-nested/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="text-xs border border-border-primary bg-bg-secondary text-text-primary rounded-lg px-2 py-1.5 outline-none focus:border-accent/50"
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg border border-border-primary text-text-secondary disabled:opacity-30 hover:border-accent/40 hover:text-accent"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-text-tertiary px-2">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg border border-border-primary text-text-secondary disabled:opacity-30 hover:border-accent/40 hover:text-accent"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-text-tertiary">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredTx.length)} of{' '}
                  {filteredTx.length}
                </span>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-text-tertiary">
            Need to add funds?{' '}
            <Link href="/wallet" className="text-accent font-semibold hover:underline">
              Open Deposit / Withdraw
            </Link>
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
