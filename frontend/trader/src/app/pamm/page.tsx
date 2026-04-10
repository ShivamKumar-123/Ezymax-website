'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import Modal from '@/components/ui/Modal';
import api from '@/lib/api/client';
import {
  TrendingUp, Users, DollarSign, AlertCircle, BarChart2,
  Wallet, Clock, CheckCircle, Info,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MammPammAccount {
  id: string;
  manager_name: string;
  master_type: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  performance_fee_pct: number;
  min_investment: number;
  active_investors: number;
  slots_available: number;
  description: string;
}

interface MyAllocation {
  id: string;
  master_id: string;
  manager_name: string;
  master_type: string;
  allocation_amount: number;
  current_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  pnl_pct: number;
  performance_fee_pct: number;
  joined_at: string;
  status: string;
}

interface AllocationSummary {
  total_invested: number;
  total_current_value: number;
  total_pnl: number;
  overall_pnl_pct: number;
}

interface MasterInvestor {
  id: string;
  user_name: string;
  user_email: string;
  account_number: string;
  allocated: number;
  pnl: number;
  pnl_pct: number;
  share_pct: number;
  copy_type: string;
  joined_at: string;
}

interface MonthlyRow {
  month: string;
  profit: number;
  cumulative: number;
}

interface MasterPerformance {
  id: string;
  status: string;
  master_type: string;
  total_aum: number;
  total_investors: number;
  fee_earnings: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  performance_fee_pct: number;
  management_fee_pct: number;
  admin_commission_pct: number;
  min_investment: number;
  max_investors: number;
  description: string | null;
  monthly_breakdown: MonthlyRow[];
}

interface MyProvider {
  id: string;
  status: string;
  master_type: string;
  performance_fee_pct: number;
  management_fee_pct: number;
  min_investment: number;
  max_investors: number;
}

interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  is_demo: boolean;
  currency: string;
}

type Tab = 'browse' | 'investments' | 'apply' | 'dashboard';

// ─── Shared helpers ─────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#00e676]/10 border border-[#00e676]/20 text-[#00e676] text-[10px] font-bold uppercase tracking-wide">
      {type}
    </span>
  );
}

function PnlText({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <span className={value >= 0 ? 'text-[#00e676]' : 'text-red-400'}>
      {value >= 0 ? '+' : ''}{fmt(value)}{suffix}
    </span>
  );
}

function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00e676] border-t-transparent" />;
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function PammPage() {
  const [activeTab, setActiveTab] = useState<Tab>('browse');

  // Browse
  const [accounts, setAccounts] = useState<MammPammAccount[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // My Investments
  const [allocations, setAllocations] = useState<MyAllocation[]>([]);
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
  const [allocLoading, setAllocLoading] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<MyAllocation | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  // My Dashboard
  const [performance, setPerformance] = useState<MasterPerformance | null>(null);
  const [investors, setInvestors] = useState<MasterInvestor[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Provider / apply
  const [myProvider, setMyProvider] = useState<MyProvider | null>(null);
  const [providerChecked, setProviderChecked] = useState(false);
  const [applying, setApplying] = useState(false);

  // Refill modal
  const [refillTarget, setRefillTarget] = useState<MyAllocation | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refilling, setRefilling] = useState(false);

  // Invest modal
  const [investTarget, setInvestTarget] = useState<MammPammAccount | null>(null);
  const [liveAccounts, setLiveAccounts] = useState<TradingAccount[]>([]);
  const [investAccount, setInvestAccount] = useState('');
  const [investAmount, setInvestAmount] = useState('');
  const [investScaling, setInvestScaling] = useState('100');
  const [investing, setInvesting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Apply form state
  const [applyAccount, setApplyAccount] = useState('');
  const [applyType, setApplyType] = useState<'pamm' | 'mamm'>('pamm');
  const [applyFee, setApplyFee] = useState('20');
  const [applyMgmtFee, setApplyMgmtFee] = useState('0');
  const [applyMinInv, setApplyMinInv] = useState('100');
  const [applyMaxInv, setApplyMaxInv] = useState('100');
  const [applyDesc, setApplyDesc] = useState('');

  // ─── Data fetchers ─────────────────────────────────────────────────────────

  const fetchBrowse = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await api.get<{ items: MammPammAccount[] }>('/social/mamm-pamm');
      setAccounts(res.items ?? []);
    } catch (err: unknown) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to load managed accounts');
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const fetchAllocations = useCallback(async () => {
    setAllocLoading(true);
    try {
      const res = await api.get<{ items: MyAllocation[]; summary: AllocationSummary }>('/social/my-allocations');
      setAllocations(res.items ?? []);
      setSummary(res.summary ?? null);
    } catch {
      // empty state
    } finally {
      setAllocLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const [perfRes, invRes] = await Promise.all([
        api.get<MasterPerformance>('/social/master-performance'),
        api.get<{ investors: MasterInvestor[] }>('/social/master-investors'),
      ]);
      setPerformance(perfRes);
      setInvestors(invRes.investors ?? []);
    } catch {
      setPerformance(null);
    } finally {
      setDashLoading(false);
    }
  }, []);

  const fetchProvider = useCallback(async () => {
    try {
      const res = await api.get<MyProvider>('/social/my-provider');
      setMyProvider(res);
    } catch {
      setMyProvider(null);
    } finally {
      setProviderChecked(true);
    }
  }, []);

  const fetchLiveAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ items: TradingAccount[] }>('/accounts');
      const live = (res.items || []).filter((a) => !a.is_demo);
      setLiveAccounts(live);
      if (live.length > 0) {
        setInvestAccount(live[0].id);
        setApplyAccount(live[0].id);
      }
    } catch {}
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      const s = await api.get<{ main_wallet_balance?: number }>('/wallet/summary');
      setWalletBalance(Number(s.main_wallet_balance) || 0);
    } catch { setWalletBalance(0); }
  }, []);

  useEffect(() => {
    fetchBrowse();
    fetchProvider();
    fetchLiveAccounts();
    fetchWallet();
  }, [fetchBrowse, fetchProvider, fetchLiveAccounts, fetchWallet]);

  useEffect(() => {
    if (activeTab === 'investments') fetchAllocations();
    if (activeTab === 'dashboard') fetchDashboard();
  }, [activeTab, fetchAllocations, fetchDashboard]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openInvest = (a: MammPammAccount) => {
    setInvestTarget(a);
    setInvestAmount(String(a.min_investment));
    setInvestScaling('100');
    if (liveAccounts.length > 0) setInvestAccount(liveAccounts[0].id);
  };

  const submitInvest = async () => {
    if (!investTarget) return;
    const amount = parseFloat(investAmount);
    if (!investAccount || isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount < investTarget.min_investment) { toast.error(`Minimum investment is $${investTarget.min_investment}`); return; }
    if (amount > walletBalance) { toast.error('Insufficient wallet balance'); return; }
    setInvesting(true);
    try {
      const params = new URLSearchParams({ account_id: investAccount, amount: investAmount });
      if (investTarget.master_type === 'mamm') {
        const s = parseFloat(investScaling);
        if (isNaN(s) || s < 1 || s > 500) { toast.error('Volume scaling must be 1–500'); setInvesting(false); return; }
        params.set('volume_scaling_pct', investScaling);
      }
      const res = await api.post<{ top_up?: number }>(`/social/mamm-pamm/${investTarget.id}/invest?${params.toString()}`, {});
      toast.success(res?.top_up ? `Top-up of $${res.top_up.toFixed(2)} added!` : 'Investment started! Amount deducted from wallet.');
      setInvestTarget(null);
      fetchBrowse();
      fetchWallet();
      if (activeTab === 'investments') fetchAllocations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to invest');
    } finally {
      setInvesting(false);
    }
  };

  const submitWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await api.delete<{ returned_to_wallet?: number }>(`/social/mamm-pamm/${withdrawTarget.id}/withdraw`);
      const returned = res?.returned_to_wallet;
      toast.success(returned != null ? `$${returned.toFixed(2)} returned to wallet` : 'Withdrawal complete');
      setWithdrawTarget(null);
      fetchAllocations();
      fetchWallet();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to withdraw');
    } finally {
      setWithdrawing(false);
    }
  };

  const openRefill = (a: MyAllocation) => {
    setRefillTarget(a);
    setRefillAmount('');
    fetchWallet();
  };

  const submitRefill = async () => {
    if (!refillTarget) return;
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBalance) { toast.error('Insufficient wallet balance'); return; }
    setRefilling(true);
    try {
      const acctId = liveAccounts[0]?.id;
      if (!acctId) { toast.error('No trading account found'); setRefilling(false); return; }
      await api.post(`/social/mamm-pamm/${refillTarget.master_id}/invest?account_id=${acctId}&amount=${amt}`, {});
      toast.success(`Added $${amt.toFixed(2)} to ${refillTarget.manager_name}`);
      setRefillTarget(null);
      fetchAllocations();
      fetchWallet();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Refill failed');
    } finally {
      setRefilling(false);
    }
  };

  const submitApply = async () => {
    if (!applyAccount) { toast.error('Select a trading account'); return; }
    setApplying(true);
    try {
      const params = new URLSearchParams({
        account_id: applyAccount,
        master_type: applyType,
        performance_fee_pct: applyFee,
        management_fee_pct: applyMgmtFee,
        min_investment: applyMinInv,
        max_investors: applyMaxInv,
        ...(applyDesc ? { description: applyDesc } : {}),
      });
      await api.post(`/social/become-provider?${params.toString()}`, {});
      toast.success('Application submitted for review');
      fetchProvider();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setApplying(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'browse', label: 'Browse' },
    { id: 'investments', label: 'My Investments' },
    { id: 'apply', label: 'Become Manager' },
    { id: 'dashboard', label: 'My Dashboard' },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardShell>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">PAMM / MAM</h1>
          <p className="text-sm text-[#888] mt-0.5">Managed account investing and trading</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#111] border border-[#2a2a2a]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors',
                activeTab === t.id
                  ? 'bg-[#00e676] text-black'
                  : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Browse ── */}
        {activeTab === 'browse' && (
          <>
            {browseLoading && (
              <div className="flex items-center justify-center py-20"><Spinner /></div>
            )}
            {!browseLoading && browseError && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <div className="flex items-center gap-2"><AlertCircle size={14} /> {browseError}</div>
                <button type="button" onClick={fetchBrowse} className="text-xs px-3 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors">Retry</button>
              </div>
            )}
            {!browseLoading && !browseError && accounts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#2a2a2a] flex items-center justify-center mb-4">
                  <TrendingUp size={24} className="text-[#555]" />
                </div>
                <p className="text-white font-medium">No managed accounts available</p>
                <p className="text-sm text-[#555] mt-1">PAMM/MAM managers will appear here once approved</p>
              </div>
            )}
            {!browseLoading && !browseError && accounts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((a) => (
                  <div key={a.id} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 flex flex-col hover:border-[#00e676]/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{a.manager_name}</p>
                        <div className="mt-1"><TypeBadge type={a.master_type} /></div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openInvest(a)}
                        className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#00e676] hover:bg-[#00c853] text-black transition-colors"
                      >
                        Invest
                      </button>
                    </div>
                    <div className="mb-4">
                      <p className="text-[10px] text-[#555] uppercase tracking-wide mb-0.5">Total ROI</p>
                      <p className={clsx('text-2xl font-bold font-mono tabular-nums', a.total_return_pct >= 0 ? 'text-[#00e676]' : 'text-red-400')}>
                        {a.total_return_pct >= 0 ? '+' : ''}{a.total_return_pct.toFixed(2)}%
                      </p>
                    </div>
                    {a.description && <p className="text-[11px] text-[#555] mb-4 line-clamp-2">{a.description}</p>}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1f1f1f] mt-auto">
                      <div>
                        <p className="text-[10px] text-[#555]">Drawdown</p>
                        <p className="text-xs font-semibold tabular-nums text-red-400">{a.max_drawdown_pct.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#555]">Investors</p>
                        <p className="text-xs font-semibold tabular-nums text-white">{a.active_investors}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#555]">Slots</p>
                        <p className="text-xs font-semibold tabular-nums text-white">{a.slots_available}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-[10px] text-[#555]">
                      <span className="flex items-center gap-1"><TrendingUp size={10} /> Fee: {a.performance_fee_pct}%</span>
                      <span className="flex items-center gap-1"><DollarSign size={10} /> Min: ${a.min_investment.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Investments ── */}
        {activeTab === 'investments' && (
          <>
            {allocLoading && <div className="flex items-center justify-center py-20"><Spinner /></div>}
            {!allocLoading && (
              <>
                {summary && allocations.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Invested', value: `$${fmt(summary.total_invested)}`, color: undefined },
                      { label: 'Current Value', value: `$${fmt(summary.total_current_value)}`, color: undefined },
                      { label: 'Total P&L', value: `${summary.total_pnl >= 0 ? '+' : ''}$${fmt(summary.total_pnl)}`, color: summary.total_pnl >= 0 ? 'text-[#00e676]' : 'text-red-400' },
                      { label: 'P&L %', value: `${summary.overall_pnl_pct >= 0 ? '+' : ''}${summary.overall_pnl_pct.toFixed(2)}%`, color: summary.overall_pnl_pct >= 0 ? 'text-[#00e676]' : 'text-red-400' },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3">
                        <p className="text-[10px] text-[#555] mb-1">{s.label}</p>
                        <p className={clsx('text-sm font-bold tabular-nums', s.color ?? 'text-white')}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {allocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#2a2a2a] flex items-center justify-center mb-4">
                      <Wallet size={24} className="text-[#555]" />
                    </div>
                    <p className="text-white font-medium">No active investments</p>
                    <p className="text-sm text-[#555] mt-1">Browse managers and invest to get started</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('browse')}
                      className="mt-4 px-4 py-2 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853] transition-colors"
                    >
                      Browse Managers
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allocations.map((a) => (
                      <div key={a.id} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 flex flex-col hover:border-[#00e676]/20 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{a.manager_name}</p>
                            <div className="mt-1"><TypeBadge type={a.master_type} /></div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {a.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => openRefill(a)}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#00e676]/40 text-[#00e676] hover:bg-[#00e676]/10 transition-colors"
                              >
                                + Refill
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setWithdrawTarget(a)}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Withdraw
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#555]">Invested</span>
                            <span className="text-white font-semibold tabular-nums">${fmt(a.allocation_amount)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#555]">Current Value</span>
                            <span className="text-white font-semibold tabular-nums">${fmt(a.current_value)}</span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-[#1f1f1f]">
                            <span className="text-[#555]">Total P&L</span>
                            <div className="text-right">
                              <p className="font-bold tabular-nums"><PnlText value={a.total_pnl} /></p>
                              <p className="text-[10px] tabular-nums"><PnlText value={a.pnl_pct} suffix="%" /></p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#555]">Realized</span>
                            <span className={a.realized_pnl >= 0 ? 'text-[#00e676]/70' : 'text-red-400/70'}>${fmt(Math.abs(a.realized_pnl))}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#555]">Unrealized</span>
                            <span className={a.unrealized_pnl >= 0 ? 'text-[#00e676]/70' : 'text-red-400/70'}>${fmt(Math.abs(a.unrealized_pnl))}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1f1f1f] text-[10px] text-[#555]">
                          <span>Fee: {a.performance_fee_pct}%</span>
                          <span>Joined {new Date(a.joined_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Become Manager ── */}
        {activeTab === 'apply' && (
          <>
            {!providerChecked ? (
              <div className="flex items-center justify-center py-20"><Spinner /></div>
            ) : myProvider ? (
              myProvider.status === 'pending' ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#00e676]/10 border border-[#00e676]/20 flex items-center justify-center mb-4">
                    <Clock size={24} className="text-[#00e676]" />
                  </div>
                  <p className="text-white font-semibold text-lg">Application Under Review</p>
                  <p className="text-sm text-[#555] mt-2 max-w-sm">Your PAMM/MAM manager application has been submitted. Our team will review it shortly.</p>
                </div>
              ) : myProvider.status === 'approved' && ['pamm', 'mamm'].includes(myProvider.master_type) ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#00e676]/10 border border-[#00e676]/20 flex items-center justify-center mb-4">
                    <CheckCircle size={24} className="text-[#00e676]" />
                  </div>
                  <p className="text-white font-semibold text-lg">You&apos;re an Approved Manager</p>
                  <p className="text-sm text-[#555] mt-2">View your investor stats and performance data</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-4 px-4 py-2 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853] transition-colors"
                  >
                    View Dashboard
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#2a2a2a] flex items-center justify-center mb-4">
                    <Info size={24} className="text-[#555]" />
                  </div>
                  <p className="text-white font-medium">Application {myProvider.status}</p>
                  <p className="text-sm text-[#555] mt-1">Contact support if you have questions</p>
                </div>
              )
            ) : (
              <div className="max-w-lg mx-auto bg-[#111] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-white">Apply as PAMM/MAM Manager</h2>
                  <p className="text-xs text-[#555] mt-1">Submit your application for admin review</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#888] mb-1.5">Trading Account</label>
                    <select
                      value={applyAccount}
                      onChange={(e) => setApplyAccount(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
                    >
                      {liveAccounts.length === 0 && <option value="">No live accounts found</option>}
                      {liveAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.account_number} — ${fmt(a.balance)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[#888] mb-1.5">Manager Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['pamm', 'mamm'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setApplyType(t)}
                          className={clsx(
                            'py-2.5 rounded-lg border text-sm font-semibold transition-colors',
                            applyType === t
                              ? 'bg-[#00e676]/10 border-[#00e676]/40 text-[#00e676]'
                              : 'border-[#2a2a2a] text-[#555] hover:text-white hover:border-[#444]',
                          )}
                        >
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#444] mt-1.5">
                      {applyType === 'pamm'
                        ? 'Pooled fund — proportional profit distribution per cycle'
                        : 'Individual accounts — proportional lot mirroring per trade'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#888] mb-1.5">Performance Fee %</label>
                      <input
                        type="number" min="0" max="50" step="0.5"
                        value={applyFee}
                        onChange={(e) => setApplyFee(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#888] mb-1.5">Management Fee %</label>
                      <input
                        type="number" min="0" max="10" step="0.1"
                        value={applyMgmtFee}
                        onChange={(e) => setApplyMgmtFee(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#888] mb-1.5">Min Investment ($)</label>
                      <input
                        type="number" min="1"
                        value={applyMinInv}
                        onChange={(e) => setApplyMinInv(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#888] mb-1.5">Max Investors</label>
                      <input
                        type="number" min="1" max="1000"
                        value={applyMaxInv}
                        onChange={(e) => setApplyMaxInv(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#888] mb-1.5">Description (optional)</label>
                    <textarea
                      rows={3}
                      value={applyDesc}
                      onChange={(e) => setApplyDesc(e.target.value)}
                      placeholder="Describe your trading strategy..."
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#00e676]/50 resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={applying || liveAccounts.length === 0}
                    onClick={submitApply}
                    className="w-full py-3 rounded-lg bg-[#00e676] text-black font-bold text-sm hover:bg-[#00c853] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {applying ? 'Submitting…' : 'Submit Application'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── My Dashboard ── */}
        {activeTab === 'dashboard' && (
          <>
            {dashLoading && <div className="flex items-center justify-center py-20"><Spinner /></div>}
            {!dashLoading && !performance && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#2a2a2a] flex items-center justify-center mb-4">
                  <BarChart2 size={24} className="text-[#555]" />
                </div>
                <p className="text-white font-medium">No manager dashboard available</p>
                <p className="text-sm text-[#555] mt-1">Apply as a PAMM/MAM manager to access this tab</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('apply')}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853] transition-colors"
                >
                  Apply Now
                </button>
              </div>
            )}
            {!dashLoading && performance && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total AUM', value: `$${fmt(performance.total_aum)}`, color: undefined },
                    { label: 'Investors', value: `${performance.total_investors} / ${performance.max_investors}`, color: undefined },
                    { label: 'Fee Earnings', value: `$${fmt(performance.fee_earnings)}`, color: 'text-[#00e676]' },
                    { label: 'Total ROI', value: `${performance.total_return_pct >= 0 ? '+' : ''}${performance.total_return_pct.toFixed(2)}%`, color: performance.total_return_pct >= 0 ? 'text-[#00e676]' : 'text-red-400' },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-4">
                      <p className="text-[10px] text-[#555] mb-1">{s.label}</p>
                      <p className={clsx('text-base font-bold tabular-nums', s.color ?? 'text-white')}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Investor list */}
                <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1f1f1f]">
                    <p className="text-sm font-semibold text-white">Investors ({investors.length})</p>
                  </div>
                  {investors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users size={20} className="text-[#555] mb-2" />
                      <p className="text-sm text-[#555]">No investors yet</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[#1f1f1f] text-[#555] text-left">
                              <th className="px-4 py-2.5 font-medium">Investor</th>
                              <th className="px-4 py-2.5 font-medium text-right">Invested</th>
                              <th className="px-4 py-2.5 font-medium text-right">P&L</th>
                              <th className="px-4 py-2.5 font-medium text-right">Share %</th>
                              <th className="px-4 py-2.5 font-medium">Type</th>
                              <th className="px-4 py-2.5 font-medium">Joined</th>
                            </tr>
                          </thead>
                          <tbody>
                            {investors.map((inv) => (
                              <tr key={inv.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#151515]">
                                <td className="px-4 py-3">
                                  <p className="text-white font-medium">{inv.user_name}</p>
                                  <p className="text-[#555] text-[10px]">{inv.account_number}</p>
                                </td>
                                <td className="px-4 py-3 text-right text-white tabular-nums">${fmt(inv.allocated)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  <PnlText value={inv.pnl} />
                                  <p className="text-[10px]"><PnlText value={inv.pnl_pct} suffix="%" /></p>
                                </td>
                                <td className="px-4 py-3 text-right text-white tabular-nums">{inv.share_pct.toFixed(1)}%</td>
                                <td className="px-4 py-3"><TypeBadge type={inv.copy_type} /></td>
                                <td className="px-4 py-3 text-[#555]">{new Date(inv.joined_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-[#1a1a1a]">
                        {investors.map((inv) => (
                          <div key={inv.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-white font-medium truncate">{inv.user_name}</p>
                              <p className="text-[10px] text-[#555]">{inv.account_number} · {new Date(inv.joined_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-white">${fmt(inv.allocated)}</p>
                              <p className="text-[11px]"><PnlText value={inv.pnl} /></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Monthly breakdown */}
                {performance.monthly_breakdown.length > 0 && (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#1f1f1f]">
                      <p className="text-sm font-semibold text-white">Monthly Performance</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#1f1f1f] text-[#555] text-left">
                            <th className="px-4 py-2.5 font-medium">Month</th>
                            <th className="px-4 py-2.5 font-medium text-right">Profit</th>
                            <th className="px-4 py-2.5 font-medium text-right">Cumulative</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performance.monthly_breakdown.map((row) => (
                            <tr key={row.month} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#151515]">
                              <td className="px-4 py-3 text-white">{row.month}</td>
                              <td className="px-4 py-3 text-right tabular-nums"><PnlText value={row.profit} /></td>
                              <td className="px-4 py-3 text-right tabular-nums text-[#888]">${fmt(row.cumulative)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* Invest Modal */}
      <Modal
        open={!!investTarget}
        onClose={() => { if (!investing) setInvestTarget(null); }}
        title={investTarget ? `Invest with ${investTarget.manager_name}` : ''}
        width="sm"
      >
        {investTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TypeBadge type={investTarget.master_type} />
              <span className="text-xs text-[#555]">Min: ${investTarget.min_investment.toLocaleString()}</span>
            </div>

            {/* Wallet balance card */}
            <div className="rounded-lg border border-[#00e676]/30 bg-[#0a0a0a] p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#666]">From Main Wallet</div>
                <div className="text-lg font-bold text-[#00e676] font-mono tabular-nums">${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <button type="button" onClick={() => setInvestAmount(String(Math.max(0, walletBalance)))} className="text-xs font-bold text-[#00e676] hover:underline">Max</button>
            </div>

            <div className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3 text-[11px] text-[#555]">
              A dedicated investment account will be auto-created for you. Your copied trades will appear there.
            </div>

            <div>
              <label className="block text-xs text-[#888] mb-1.5">Investment Amount ($)</label>
              <input
                type="number"
                min={investTarget.min_investment}
                max={walletBalance}
                step="0.01"
                value={investAmount}
                onChange={(e) => setInvestAmount(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
              />
            </div>

            {investTarget.master_type === 'mamm' && (
              <div>
                <label className="block text-xs text-[#888] mb-1.5">Volume Scaling %</label>
                <input
                  type="number" min="1" max="500" step="1"
                  value={investScaling}
                  onChange={(e) => setInvestScaling(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
                />
                <p className="text-[10px] text-[#444] mt-1">100 = proportional share · 200 = 2× leverage</p>
              </div>
            )}

            <div className="rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] p-3 text-[11px] text-[#555]">
              Performance fee: <span className="text-white">{investTarget.performance_fee_pct}%</span> · Slots left: <span className="text-white">{investTarget.slots_available}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInvestTarget(null)}
                disabled={investing}
                className="flex-1 py-2.5 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitInvest}
                disabled={investing}
                className="flex-1 py-2.5 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853] disabled:opacity-50 transition-colors"
              >
                {investing ? 'Investing…' : 'Confirm Invest'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        open={!!withdrawTarget}
        onClose={() => { if (!withdrawing) setWithdrawTarget(null); }}
        title="Withdraw Investment"
        width="sm"
      >
        {withdrawTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#555]">Manager</span>
                <span className="text-white font-medium">{withdrawTarget.manager_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">Invested</span>
                <span className="text-white">${fmt(withdrawTarget.allocation_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">Total P&L</span>
                <span><PnlText value={withdrawTarget.total_pnl} /></span>
              </div>
            </div>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-yellow-500/[0.08] border border-yellow-500/20 text-[11px] text-yellow-400">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>All open positions tied to this investment will be closed automatically.</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setWithdrawTarget(null)}
                disabled={withdrawing}
                className="flex-1 py-2.5 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitWithdraw}
                disabled={withdrawing}
                className="flex-1 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                {withdrawing ? 'Withdrawing…' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refill Modal */}
      <Modal
        open={!!refillTarget}
        onClose={() => { if (!refilling) setRefillTarget(null); }}
        title="Refill Investment"
        width="sm"
      >
        {refillTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#555]">Manager</span>
                <span className="text-white font-medium">{refillTarget.manager_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">Current Investment</span>
                <span className="text-white font-semibold">${fmt(refillTarget.allocation_amount)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-[#00e676]/30 bg-[#0a0a0a] p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#666]">Wallet Balance</div>
                <div className="text-lg font-bold text-[#00e676] font-mono tabular-nums">
                  ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button type="button" onClick={() => setRefillAmount(String(walletBalance))} className="text-xs font-bold text-[#00e676] hover:underline">Max</button>
            </div>

            <div>
              <label className="block text-xs text-[#888] mb-1.5">Add Amount ($)</label>
              <input
                type="number" min="1" step="0.01" value={refillAmount}
                onChange={(e) => setRefillAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00e676]/50"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setRefillTarget(null)} disabled={refilling}
                className="flex-1 py-2.5 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={submitRefill} disabled={refilling || !refillAmount}
                className="flex-1 py-2.5 rounded-lg bg-[#00e676] text-black text-xs font-bold hover:bg-[#00c853] disabled:opacity-50 transition-colors">
                {refilling ? 'Adding…' : 'Add Funds'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </DashboardShell>
  );
}
