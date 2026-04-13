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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Transaction History
              </h1>
              <p className="text-text-secondary text-xs sm:text-sm mt-1">
                View all your deposits, withdrawals, transfers, and credits
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchData(true)}
              disabled={refreshing}
              className={clsx(
                'shrink-0 p-2 rounded-lg border border-border-primary bg-card hover:bg-bg-hover transition-all',
                refreshing && 'opacity-50 cursor-not-allowed',
              )}
              aria-label="Refresh"
            >
              <RefreshCcw className={clsx('w-4 h-4 text-text-secondary', refreshing && 'animate-spin')} />
            </button>
          </div>

          {loadError && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-text-primary">
              {loadError}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {/* Total Deposits */}
            <div
              className="relative group rounded-2xl overflow-hidden p-4 sm:p-5 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(145deg, rgba(0,230,118,0.12) 0%, #0d0f10 70%)',
                border: '1px solid rgba(0,230,118,0.18)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[50px] bg-[#00e676]/[0.04] pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border border-[#00e676]/25"
                  style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(0,230,118,0.06) 100%)' }}
                >
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#00e676]" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,118,0.5))' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#00e676]/60">Total Deposits</p>
                  <p className="text-sm sm:text-lg md:text-xl font-bold font-mono text-white tabular-nums mt-0.5 truncate">
                    {fmt(totalDeposited)}
                  </p>
                </div>
              </div>
            </div>

            {/* Total Withdrawals */}
            <div
              className="relative group rounded-2xl overflow-hidden p-4 sm:p-5 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(145deg, rgba(239,68,68,0.1) 0%, #0d0f10 70%)',
                border: '1px solid rgba(239,68,68,0.18)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[50px] bg-red-500/[0.04] pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border border-red-500/25"
                  style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.06) 100%)' }}
                >
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.5))' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-red-400/60">Withdrawals</p>
                  <p className="text-sm sm:text-lg md:text-xl font-bold font-mono text-white tabular-nums mt-0.5 truncate">
                    {fmt(totalWithdrawn)}
                  </p>
                </div>
              </div>
            </div>

            {/* Affiliate Commissions */}
            <div
              className="relative group rounded-2xl overflow-hidden p-4 sm:p-5 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(145deg, rgba(0,230,118,0.08) 0%, #0d0f10 70%)',
                border: '1px solid rgba(0,230,118,0.15)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[50px] bg-[#00e676]/[0.03] pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border border-[#00e676]/20"
                  style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.15) 0%, rgba(0,230,118,0.04) 100%)' }}
                >
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-[#00e676]" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,118,0.4))' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#00e676]/50">Commissions</p>
                  <p className="text-sm sm:text-lg md:text-xl font-bold font-mono text-white tabular-nums mt-0.5 truncate">
                    {fmt(0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div
              className="relative group rounded-2xl overflow-hidden p-4 sm:p-5 transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(145deg, rgba(245,158,11,0.1) 0%, #0d0f10 70%)',
                border: '1px solid rgba(245,158,11,0.18)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[50px] bg-amber-500/[0.04] pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border border-amber-500/25"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.06) 100%)' }}
                >
                  <Hourglass className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.5))' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-amber-400/60">Pending</p>
                  <p className="text-sm sm:text-lg md:text-xl font-bold font-mono text-white tabular-nums mt-0.5">
                    {pendingTxCount} <span className="text-sm font-semibold text-text-tertiary">transactions</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#0d0f10',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header with title + type tabs */}
            <div className="px-4 sm:px-6 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Transactions</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['all', 'All'],
                    ['deposit', 'Deposits'],
                    ['withdrawal', 'Withdrawals'],
                    ['transfer', 'Transfers'],
                    ['commission', 'Commissions'],
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
                      'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200',
                      typeFilter === t
                        ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                        : 'text-[#888] hover:text-white border border-transparent hover:border-white/10',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary filters row — status + dates */}
            <div className="px-3 sm:px-6 pb-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
              {(['all', 'completed', 'pending', 'failed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={clsx(
                    'px-3 py-1 text-[11px] font-semibold rounded-full border transition-all',
                    statusFilter === s
                      ? s === 'completed'
                        ? 'bg-[#00e676]/15 text-[#00e676] border-[#00e676]/30'
                        : s === 'pending'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : s === 'failed'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : 'bg-white/8 text-white border-white/15'
                      : 'border-white/6 text-[#666] hover:text-[#aaa] hover:border-white/12',
                  )}
                >
                  {s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <div className="w-px h-5 bg-white/8 mx-1" />
              <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto mt-1.5 sm:mt-0">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="px-2 sm:px-2.5 py-1 rounded-lg border border-white/8 bg-white/[0.03] text-[10px] sm:text-[11px] text-[#aaa] outline-none focus:border-[#00e676]/30 flex-1 sm:flex-none sm:w-[120px] min-w-0"
                  placeholder="From"
                />
                <span className="text-[#444] text-xs shrink-0">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="px-2 sm:px-2.5 py-1 rounded-lg border border-white/8 bg-white/[0.03] text-[10px] sm:text-[11px] text-[#aaa] outline-none focus:border-[#00e676]/30 flex-1 sm:flex-none sm:w-[120px] min-w-0"
                  placeholder="To"
                />
              </div>
              {(dateFrom || dateTo || typeFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 ml-auto transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.06]" />

            {/* Transaction list */}
            <div className="px-3 sm:px-6 py-3 sm:py-5 space-y-1.5 sm:space-y-2">
              {!pagedTx.length ? (
                <div className="py-16 text-center">
                  <ArrowLeftRight className="w-10 h-10 text-[#333] mx-auto mb-3" />
                  <p className="text-[#888] text-sm font-medium">
                    {filteredTx.length === 0 && transactions.length > 0
                      ? 'No transactions match your filters'
                      : 'No transfers yet'}
                  </p>
                  <p className="text-[#555] text-xs mt-1">Your transaction history will appear here</p>
                </div>
              ) : (
                pagedTx.map((tx) => {
                  const signed = tx.signedAmount;
                  const isIn = signed >= 0;
                  const iconWrap = clsx(
                    'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 border border-border-primary',
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
                      className="rounded-xl p-2.5 sm:p-3 md:p-4 flex items-center gap-2 sm:gap-3 transition-all hover:bg-white/[0.02]"
                      style={{ border: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className={iconWrap}>
                        {tx.type === 'deposit' ? (
                          <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : tx.type === 'withdrawal' ? (
                          <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : tx.type === 'transfer' ? (
                          <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : tx.type === 'profit' || tx.type === 'credit' || tx.type === 'bonus' ? (
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : tx.type === 'loss' || tx.type === 'correction' ? (
                          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-text-primary font-semibold text-xs sm:text-sm truncate">
                              {transactionTitle(tx)}{' '}
                              <span className="text-text-tertiary font-normal text-[10px] sm:text-xs hidden sm:inline">· {tx.method}</span>
                            </h3>
                            {tx.description ? (
                              <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2">{tx.description}</p>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={clsx(
                                'text-xs sm:text-sm font-bold font-mono tabular-nums',
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
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#666]">Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="text-[11px] border border-white/8 bg-white/[0.03] text-[#aaa] rounded-lg px-2 py-1.5 outline-none focus:border-[#00e676]/30"
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
                    className="p-1.5 rounded-lg border border-white/8 text-[#888] disabled:opacity-30 hover:border-[#00e676]/30 hover:text-[#00e676] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] text-[#666] px-2">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg border border-white/8 text-[#888] disabled:opacity-30 hover:border-[#00e676]/30 hover:text-[#00e676] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[11px] text-[#666]">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredTx.length)} of{' '}
                  {filteredTx.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
