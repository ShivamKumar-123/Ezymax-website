'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

export default function EarnPlayZonePage() {
  return (
    <DashboardShell>
      <div className="space-y-5 pb-8">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            Play Zone <Sparkles size={22} className="text-[#d6a93d]" />
          </h1>
          <p className="text-sm text-text-secondary mt-1">Spend your FXArtha Coins on Spin &amp; Win rewards.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActiveCard
            icon={Sparkles}
            title="Spin & Win"
            blurb="30 FXA per spin. Win up to 500 FXA instantly."
            href="/earn/play-zone/spin"
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function ActiveCard({
  icon: Icon, title, blurb, href,
}: { icon: any; title: string; blurb: string; href: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-[#d6a93d]/35 bg-gradient-to-br from-[#d6a93d]/10 via-bg-secondary to-bg-secondary p-5 hover:border-[#d6a93d]/65 transition-colors"
    >
      <div className="flex items-center justify-between">
        <Icon size={22} className="text-[#d6a93d]" />
        <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-emerald-400 border border-emerald-400/30 bg-emerald-400/5 px-2 py-0.5 rounded-full">
          Live
        </span>
      </div>
      <h3 className="text-base font-semibold text-text-primary mt-3 flex items-center gap-1.5">
        {title}
        <ArrowRight size={14} className="text-text-tertiary group-hover:text-[#d6a93d] group-hover:translate-x-0.5 transition-transform" />
      </h3>
      <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{blurb}</p>
    </Link>
  );
}
