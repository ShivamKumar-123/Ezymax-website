'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Loader2, Lock, Sparkles, Wallet, ArrowRight, Check } from 'lucide-react';
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

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            Staking <Coins size={22} className="text-[#d6a93d]" />
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Provide liquidity and earn structured rewards. Flexible mode or long-term lock — your choice.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#d6a93d]/30 bg-[#d6a93d]/5">
          <Wallet size={14} className="text-[#d6a93d]" />
          <span className="text-sm font-semibold text-text-primary tabular-nums">
            {fmtUsd(walletBalance)} available
          </span>
        </div>
      </header>

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
