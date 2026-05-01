'use client';

import Link from 'next/link';
import { Sparkles, Ticket, Gavel, Clock, ArrowRight } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';

export default function EarnPlayZonePage() {
  return (
    <DashboardShell>
      <div className="space-y-5 pb-8">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            Play Zone <Sparkles size={22} className="text-[#d6a93d]" />
          </h1>
          <p className="text-sm text-text-secondary mt-1">Spend your Artha Coins on Spin, Lottery, and Bidding rewards.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActiveCard
            icon={Sparkles}
            title="Spin & Win"
            blurb="30 AC per spin. Win up to 500 AC instantly."
            href="/earn/play-zone/spin"
          />
          <ComingSoonCard
            icon={Ticket}
            title="Lottery"
            tag="Soon"
            blurb="100 AC per ticket. Weekly draws for big rewards."
          />
          <ComingSoonCard
            icon={Gavel}
            title="Bidding"
            tag="Soon"
            blurb="Bid Artha Coins on premium prizes. Losers refunded 50%."
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

function ComingSoonCard({
  icon: Icon, title, tag, blurb,
}: { icon: any; title: string; tag: string; blurb: string }) {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
      <div className="flex items-center justify-between">
        <Icon size={22} className="text-[#d6a93d]" />
        <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-amber-400/85 border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 rounded-full">
          <Clock size={11} /> {tag}
        </span>
      </div>
      <h3 className="text-base font-semibold text-text-primary mt-3">{title}</h3>
      <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{blurb}</p>
    </div>
  );
}
