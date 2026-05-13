'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Coins, Loader2, Lock, Sparkles, Wallet, ArrowRight, Check,
  BarChart3, TrendingUp, Calendar, Gift,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import StakingPlanCard, { StakingPlan } from '@/components/earn/StakingPlanCard';
import api from '@/lib/api/client';

type Position = {
  id: string;
  plan: StakingPlan;
  principal: number;
  started_at: string;
  unlocks_at: string | null;
  state: 'active' | 'withdrawn' | 'early_exit';
  trading_bonus_active: boolean;
  trading_bonus_credited: number;
  rewards_unpaid: number;
  rewards_paid: number;
};

const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtUsd = (n: number) => `$${fmt(n)}`;

export default function StakingPage() {
  return (
    <DashboardShell>
      <Inner />
    </DashboardShell>
  );
}

function Inner() {
  const [plans, setPlans] = useState<StakingPlan[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [useTradingBonus, setUseTradingBonus] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyPosId, setBusyPosId] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  const loadAll = useCallback(async () => {
    try {
      const [plansR, positionsR, wallet] = await Promise.all([
        api.get<StakingPlan[]>('/staking/plans'),
        api.get<Position[]>('/staking/positions'),
        api.get<{ main_wallet_balance?: number; balance?: number }>('/wallet/summary'),
      ]);
      setPlans(plansR);
      setPositions(positionsR);
      setWalletBalance(Number(wallet.main_wallet_balance ?? wallet.balance ?? 0));
      if (plansR.length > 0 && !selectedPlanId) {
        // Default to the first locked plan if any, else the flexible one.
        const def = plansR.find((p) => p.mode === 'locked') || plansR[0];
        setSelectedPlanId(def.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not load staking');
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId]);

  useEffect(() => { void loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpen = async () => {
    if (!selectedPlan) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    if (amt < selectedPlan.min_amount) {
      toast.error(`Minimum stake for this plan is ${fmtUsd(selectedPlan.min_amount)}`);
      return;
    }
    if (amt > walletBalance) {
      toast.error('Insufficient wallet balance');
      return;
    }
    setBusy(true);
    try {
      await api.post('/staking/positions', {
        plan_id: selectedPlan.id,
        amount: amt,
        use_trading_bonus: selectedPlan.mode === 'locked' ? useTradingBonus : false,
      });
      toast.success(`Staked ${fmtUsd(amt)} into ${selectedPlan.label}`);
      setAmount('');
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'insufficient_wallet_balance') toast.error('Not enough in your main wallet');
      else if (typeof detail === 'string' && detail.startsWith('min_amount')) toast.error('Below the plan minimum');
      else toast.error(detail || err?.message || 'Could not open stake');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async (p: Position) => {
    setBusyPosId(p.id);
    try {
      await api.post(`/staking/positions/${p.id}/withdraw`, {});
      toast.success('Principal returned to your wallet');
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'position_locked') toast.error('Locked plans can only be withdrawn after the term ends');
      else toast.error(detail || err?.message || 'Could not withdraw');
    } finally {
      setBusyPosId(null);
    }
  };

  const handleClaim = async (p: Position) => {
    setBusyPosId(p.id);
    try {
      const res = await api.post<{ claimed: number }>(`/staking/positions/${p.id}/claim-rewards`, {});
      if (res.claimed > 0) toast.success(`Claimed ${fmtUsd(res.claimed)} in rewards`);
      else toast(`No rewards available yet`, { icon: 'i' });
      await loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Could not claim');
    } finally {
      setBusyPosId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-secondary text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading staking…
      </div>
    );
  }

  // Aggregate stats for the DAG-style top cards.
  const activePositions = positions.filter((p) => p.state === 'active');
  const totalStaked = activePositions.reduce((s, p) => s + (Number(p.principal) || 0), 0);
  const totalEarned = positions.reduce(
    (s, p) => s + (Number(p.rewards_paid) || 0) + (Number(p.rewards_unpaid) || 0),
    0,
  );
  const totalTradingBonus = positions.reduce(
    (s, p) => s + (Number(p.trading_bonus_credited) || 0),
    0,
  );
  // Approx next payout: sum of unpaid rewards across active positions. The
  // exact "next payout date" lives in staking_reward_accruals; surface here
  // as the soonest unlocks_at among active locked positions.
  const nextPayoutAmount = activePositions.reduce((s, p) => s + (Number(p.rewards_unpaid) || 0), 0);
  const nextPayoutDate = activePositions
    .map((p) => (p.unlocks_at ? new Date(p.unlocks_at).getTime() : Infinity))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            Staking Dashboard
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Stake your funds and earn high returns with trading bonus.
          </p>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-purple-500/30 bg-gradient-to-br from-[#3a1c5e]/40 to-[#2a1442]/40">
          <div className="w-9 h-9 rounded-xl bg-purple-500/25 border border-purple-400/30 flex items-center justify-center">
            <Wallet size={16} className="text-purple-300" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-purple-200/70 font-medium">Wallet Balance</p>
            <p className="text-sm font-bold text-white font-mono tabular-nums">{fmtUsd(walletBalance)}</p>
          </div>
        </div>
      </header>

      {/* ── 4 stat cards (DAG aesthetic per client mockup) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Staked */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#3a1c5e] via-[#4a2470] to-[#2a1442] border border-purple-500/20">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/25 border border-purple-400/30 flex items-center justify-center shrink-0">
              <BarChart3 size={20} className="text-purple-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-purple-200/80 font-medium">Total Staked</p>
              <p className="text-lg font-bold text-white mt-1 font-mono tabular-nums truncate">{fmtUsd(totalStaked)}</p>
              <p className="text-[10px] text-purple-200/60 mt-0.5">Across {activePositions.length} active {activePositions.length === 1 ? 'stake' : 'stakes'}</p>
            </div>
          </div>
        </div>

        {/* Total Earned (All Time) */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0d3f2a] via-[#0f5535] to-[#082921] border border-emerald-500/20">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/25 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <TrendingUp size={20} className="text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-emerald-200/80 font-medium">Total Earned (All Time)</p>
              <p className="text-lg font-bold text-white mt-1 font-mono tabular-nums truncate">{fmtUsd(totalEarned)}</p>
              <p className="text-[10px] text-emerald-200/60 mt-0.5">Paid + accrued rewards</p>
            </div>
          </div>
        </div>

        {/* Next Payout */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0e2a55] via-[#143a72] to-[#0b1d3d] border border-blue-500/20">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/25 border border-blue-400/30 flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-blue-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-blue-200/80 font-medium">Next Payout</p>
              <p className="text-lg font-bold text-white mt-1 font-mono tabular-nums truncate">{fmtUsd(nextPayoutAmount)}</p>
              <p className="text-[10px] text-blue-200/60 mt-0.5">
                {nextPayoutDate && Number.isFinite(nextPayoutDate)
                  ? `Unlocks ${new Date(nextPayoutDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : 'No upcoming unlocks'}
              </p>
            </div>
          </div>
        </div>

        {/* Total Trading Bonus */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#4a3a0d] via-[#5e4a10] to-[#2e2407] border border-amber-500/20">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/25 border border-amber-400/30 flex items-center justify-center shrink-0">
              <Gift size={20} className="text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-amber-200/80 font-medium">Total Trading Bonus</p>
              <p className="text-lg font-bold text-white mt-1 font-mono tabular-nums truncate">{fmtUsd(totalTradingBonus)}</p>
              <p className="text-[10px] text-amber-200/60 mt-0.5">Bonus balance available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((p) => (
          <StakingPlanCard
            key={p.id}
            plan={p}
            selected={selectedPlanId === p.id}
            onSelect={() => setSelectedPlanId(p.id)}
          />
        ))}
      </div>

      {/* Open form */}
      {selectedPlan && (
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              {selectedPlan.mode === 'locked' ? <Lock size={16} className="text-[#d6a93d]" /> : <Sparkles size={16} className="text-[#d6a93d]" />}
              Open a {selectedPlan.label} stake
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-text-secondary mb-1 block">Amount (USD)</label>
                <input
                  type="number"
                  min={selectedPlan.min_amount}
                  step="0.01"
                  placeholder={`Min ${fmtUsd(selectedPlan.min_amount)}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-bg-base border border-border-primary text-sm text-text-primary tabular-nums focus:border-[#d6a93d] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleOpen}
                disabled={busy || !amount}
                className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-bold bg-[#d6a93d] text-bg-base hover:brightness-110 disabled:opacity-60 transition-colors"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Stake
              </button>
            </div>

            {selectedPlan.mode === 'locked' && selectedPlan.trading_bonus_multiplier_bps > 0 && (
              <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTradingBonus}
                  onChange={(e) => setUseTradingBonus(e.target.checked)}
                  className="mt-0.5 accent-[#d6a93d]"
                />
                <span>
                  Activate {selectedPlan.trading_bonus_pct.toFixed(0)}% trading bonus
                  <span className="text-text-tertiary"> — credits an equivalent amount to your live trading account. Funds stay locked until the term ends.</span>
                </span>
              </label>
            )}
          </div>

          <aside className="rounded-lg border border-border-primary bg-bg-base p-4 text-xs space-y-2">
            <Row label="APY" value={`${selectedPlan.apy_pct.toFixed(0)}%`} />
            <Row label="Mode" value={selectedPlan.mode === 'locked' ? `Locked ${selectedPlan.lock_months ?? ''} mo` : 'Flexible'} />
            <Row label="Min stake" value={fmtUsd(selectedPlan.min_amount)} />
            {selectedPlan.trading_bonus_multiplier_bps > 0 && (
              <Row label="Trading bonus" value={`${selectedPlan.trading_bonus_pct.toFixed(0)}%`} />
            )}
            <p className="text-[10.5px] text-text-tertiary leading-relaxed pt-2">
              Rewards accrue daily. Claim them anytime — they land in your main wallet.
            </p>
          </aside>
        </div>
      )}

      {/* Positions */}
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">Your stakes</h2>
        {positions.length === 0 ? (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-8 text-center text-sm text-text-tertiary">
            No active stakes yet. Pick a plan above to get started.
          </div>
        ) : (
          <ul className="space-y-2">
            {positions.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border-primary bg-bg-secondary p-4 flex flex-col md:flex-row md:items-center gap-3"
              >
                <div className="md:w-48">
                  <p className="text-sm font-semibold text-text-primary">{p.plan.label}</p>
                  <p className="text-[11px] text-text-tertiary">
                    Started {new Date(p.started_at).toLocaleDateString()}
                    {p.unlocks_at ? ` · Unlocks ${new Date(p.unlocks_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <Stat label="Principal" value={fmtUsd(p.principal)} />
                  <Stat label="Unclaimed" value={fmtUsd(p.rewards_unpaid)} accent />
                  <Stat label="Claimed" value={fmtUsd(p.rewards_paid)} />
                </div>
                <div className="flex items-center gap-2">
                  {p.state === 'active' && p.rewards_unpaid > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClaim(p)}
                      disabled={busyPosId === p.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-[#d6a93d] text-bg-base hover:brightness-110 disabled:opacity-60"
                    >
                      {busyPosId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Claim
                    </button>
                  )}
                  {p.state === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleWithdraw(p)}
                      disabled={busyPosId === p.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-border-primary text-text-secondary hover:text-text-primary hover:border-[#d6a93d]/45 disabled:opacity-60"
                    >
                      {p.plan.mode === 'flexible' ? 'Withdraw' : 'Withdraw at unlock'}
                    </button>
                  )}
                  {p.state !== 'active' && (
                    <span className="px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider text-text-tertiary border border-border-primary">
                      {p.state.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-tertiary">{label}</span>
      <span className="font-semibold text-text-primary tabular-nums">{value}</span>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className={'text-sm font-semibold tabular-nums ' + (accent ? 'text-[#d6a93d]' : 'text-text-primary')}>
        {value}
      </p>
    </div>
  );
}
