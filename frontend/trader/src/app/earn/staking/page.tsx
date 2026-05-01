'use client';

import { Coins, Lock, Zap, Clock } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

export default function EarnStakingPage() {
  return (
    <DashboardShell>
      <div className="space-y-5 pb-8">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            Staking <Coins size={22} className="text-[#d6a93d]" />
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Provide liquidity and earn structured rewards. Flexible mode or long-term lock — your choice.
          </p>
        </header>

        <div className="rounded-xl border border-[#d6a93d]/25 bg-gradient-to-br from-[#d6a93d]/8 via-bg-secondary to-bg-secondary p-6">
          <div className="flex items-start gap-4">
            <Clock size={28} className="text-[#d6a93d] mt-1 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Coming in the next release</h2>
              <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                We're putting the finishing touches on the staking module. You'll be able to choose
                between a flexible plan (no lock-in) and locked plans of 1, 2, or 3 years for higher
                rewards plus a trading bonus equal to your committed liquidity.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PreviewCard
            icon={Zap}
            title="Flexible"
            blurb="No lock-in. Withdraw anytime. Lower reward rate."
          />
          <PreviewCard
            icon={Lock}
            title="Locked (1Y / 2Y / 3Y)"
            blurb="Commit for a fixed term to unlock higher rewards plus a 1× trading bonus."
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function PreviewCard({ icon: Icon, title, blurb }: { icon: any; title: string; blurb: string }) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
      <Icon size={22} className="text-[#d6a93d]" />
      <h3 className="text-base font-semibold text-text-primary mt-3">{title}</h3>
      <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{blurb}</p>
    </div>
  );
}
