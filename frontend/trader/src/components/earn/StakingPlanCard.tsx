'use client';

import { Lock, Zap, Sparkles } from 'lucide-react';

export type StakingPlan = {
  id: string;
  slug: string;
  label: string;
  description: string;
  mode: 'flexible' | 'locked';
  lock_months: number | null;
  apy_bps: number;
  apy_pct: number;
  min_amount: number;
  trading_bonus_multiplier_bps: number;
  trading_bonus_pct: number;
};

export default function StakingPlanCard({
  plan, selected, onSelect,
}: { plan: StakingPlan; selected: boolean; onSelect: () => void }) {
  const Icon = plan.mode === 'flexible' ? Zap : Lock;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'text-left rounded-xl p-5 transition-all border ' +
        (selected
          ? 'border-[#d6a93d] bg-[#d6a93d]/8 ring-2 ring-[#d6a93d]/45'
          : 'border-border-primary bg-bg-secondary hover:border-[#d6a93d]/45')
      }
    >
      <div className="flex items-center justify-between">
        <Icon size={20} className="text-[#d6a93d]" />
        {plan.trading_bonus_multiplier_bps > 0 && (
          <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-[#d6a93d] border border-[#d6a93d]/40 bg-[#d6a93d]/10 px-2 py-0.5 rounded-full">
            <Sparkles size={10} /> 1× bonus
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-text-primary mt-3">{plan.label}</h3>
      <div className="text-3xl font-extrabold text-[#d6a93d] tabular-nums mt-1">
        {plan.apy_pct.toFixed(0)}%
        <span className="text-xs text-text-tertiary font-normal ml-1">APY</span>
      </div>
      <p className="text-xs text-text-secondary mt-2 leading-relaxed min-h-[36px]">{plan.description}</p>
      <div className="mt-3 pt-3 border-t border-border-primary text-[11px] text-text-tertiary flex flex-wrap gap-x-3 gap-y-1">
        <span>Min ${plan.min_amount.toFixed(0)}</span>
        {plan.mode === 'locked' && plan.lock_months ? (
          <span>Lock {plan.lock_months} mo</span>
        ) : (
          <span>No lock</span>
        )}
      </div>
    </button>
  );
}
