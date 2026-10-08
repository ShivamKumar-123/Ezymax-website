"use client";

import * as React from "react";
import { Download, LineChart, Percent, Scale, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, KpiCard, Money, PageHeader, Reveal } from "@/components/kit";
import { COACH } from "@ezymex/mock/academy";
import { CoachChat, type CoachChatHandle } from "@/components/academy/coach-chat";
import { OvertradingCard, RiskDistribution, SessionHeat, SymbolInsight } from "@/components/academy/coach-insights";
import { JournalCard } from "@/components/academy/journal";

export default function CoachPage() {
  const chat = React.useRef<CoachChatHandle>(null);
  const w = COACH.week;
  const p = COACH.prevWeek;
  return (
    <div className="pb-16">
      <PageHeader
        title="AI Coach"
        subtitle="Ezymex Coach reads your trade history and journal, then explains what's working in plain language."
        actions={
          <Button variant="surface" onClick={() => toast.success("Weekly review exported", { description: "ezymex-coach-review-2026-W39.pdf" })}>
            <Download /> Export review
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Net P/L · this week" icon={<LineChart />} value={<Money value={w.net} signed tone="up" />} chip={`${w.count} trades · ${w.lots} lots`} chipTone="up" />
        <KpiCard label="Win rate" icon={<Percent />} value={<span className="k-num">{w.winRate.toFixed(1)}<span className="opacity-40">%</span></span>} chip={`+${(w.winRate - p.winRate).toFixed(1)} pts vs last week`} chipTone="up" delay={0.05} />
        <KpiCard label="Avg win / avg loss" icon={<Scale />} value={<span className="k-num">{(w.avgWin / w.avgLoss).toFixed(2)}<span className="opacity-40">R</span></span>} chip="Losses bigger than wins" chipTone="down" delay={0.1} />
        <KpiCard label="Discipline score" value={<span className="k-num">72<span className="opacity-40">/100</span></span>} hot illustration="shield" chip={<><ShieldCheck className="size-3" /> 3 rule breaks</>} chipTone="ember" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <CoachChat ref={chat} className="h-[680px] xl:h-[760px]" />
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
          <Reveal delay={0.15}>
            <SymbolInsight />
          </Reveal>
          <Reveal delay={0.2}>
            <SessionHeat />
          </Reveal>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Reveal delay={0.1} className="lg:col-span-5">
          <RiskDistribution />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-7">
          <OvertradingCard />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <JournalCard />
      </Reveal>
    </div>
  );
}
