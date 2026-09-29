"use client";

import * as React from "react";
import { FlaskConical, History, LayoutTemplate, Plus, Rocket, Target, Users, Workflow } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Avatar, Button, Card, Chip, KpiCard, PageHeader, Reveal, StatusChip, Toggle, cn } from "@kalks/ui";
import { MKT_JOURNEYS, type MktJourney } from "@kalks/mock/admin-growth-marketing";
import { JourneyCanvas } from "@/components/marketing/journey-canvas";
import { fmtDateTime, fmtInt } from "@/components/marketing/kit";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveJourneys } from "@/components/marketing/live/journeys";

/** Live workspaces run journeys on the growth service; the demo showcase keeps the mock canvas. */
export default function AutomationPage() {
  if (!IS_DEMO) return <LiveJourneys />;
  return <DemoAutomation />;
}

function DemoAutomation() {
  const [selId, setSelId] = React.useState(MKT_JOURNEYS[0]!.id);
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(Object.fromEntries(MKT_JOURNEYS.map((j) => [j.id, j.enabled])));
  const sel = MKT_JOURNEYS.find((j) => j.id === selId)!;
  const enrolled = MKT_JOURNEYS.reduce((s, j) => s + j.enrolled, 0);
  const converted = MKT_JOURNEYS.reduce((s, j) => s + j.converted, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Automation"
        subtitle="Trigger-based journeys across email, in-app, SMS and push."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.info("Journey templates", { description: "12 broker-tested templates: onboarding, KYC, win-back, risk education…" })}>
              <LayoutTemplate /> Templates
            </Button>
            <Button variant="ember" shimmer onClick={() => toast.success("Blank journey created", { description: "Add a trigger to get started" })}>
              <Plus /> New journey
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Live journeys" icon={<Workflow />} value={<span className="k-num">{Object.values(enabled).filter(Boolean).length}</span>} chip={`${MKT_JOURNEYS.length} total`} />
        <KpiCard label="Clients enrolled · 90d" icon={<Users />} value={<span className="k-num">{fmtInt(enrolled)}</span>} chip="+14.8% vs prior" chipTone="up" delay={0.05} />
        <KpiCard label="Goals reached" icon={<Target />} value={<span className="k-num">{fmtInt(converted)}</span>} chip={`${((converted / enrolled) * 100).toFixed(1)}% overall`} chipTone="gold" delay={0.1} />
        <KpiCard label="Attributed FTD volume" value={<span className="k-num">$2.84M</span>} hot illustration="robot" footer={<Chip tone="up">ROI 18.2x on send cost</Chip>} delay={0.15} />
      </div>

      <Reveal delay={0.08} className="mt-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
            <div>
              <h3 className="text-[17px] font-medium tracking-tight">Journeys</h3>
              <p className="text-[13px] text-fg-3">Select a journey to open it on the canvas</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_100px_100px_minmax(0,1.3fr)_120px_64px] items-center gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">
                <span>Journey</span>
                <span>Trigger</span>
                <span className="text-right">Enrolled</span>
                <span className="text-right">Converted</span>
                <span>Conversion</span>
                <span>Updated</span>
                <span className="text-right">Live</span>
              </div>
              {MKT_JOURNEYS.map((j) => (
                <JourneyRow key={j.id} j={j} selected={j.id === selId} enabled={enabled[j.id]!} onSelect={() => setSelId(j.id)} onToggle={(v) => { setEnabled((x) => ({ ...x, [j.id]: v })); toast.success(v ? `${j.name} is live` : `${j.name} paused`, { description: v ? "New clients matching the trigger will enrol" : "Clients mid-journey will finish their current step" }); }} />
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.12} className="mt-4">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2">
                <Workflow className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[17px] font-medium tracking-tight">{sel.name}</h3>
                  <StatusChip status={enabled[sel.id] ? "running" : "paused"} label={enabled[sel.id] ? "Live" : "Paused"} />
                  <Chip size="sm">v{7 - MKT_JOURNEYS.indexOf(sel)}</Chip>
                </div>
                <p className="truncate text-[12.5px] text-fg-3">
                  {sel.trigger} → {sel.goal} · edited {fmtDateTime(sel.updated)} by {sel.owner.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => toast.info("Version history", { description: "7 versions · last published 22 Sep by Priya Nair" })}>
                <History /> History
              </Button>
              <Button size="sm" variant="surface" onClick={() => toast.success("Test run started", { description: "Simulating with test client 80412337 — check your inbox" })}>
                <FlaskConical /> Test run
              </Button>
              <Button size="sm" variant="ember" onClick={() => toast.success(`${sel.name} published`, { description: "Changes apply to new enrolments immediately" })}>
                <Rocket /> Publish
              </Button>
            </div>
          </div>
          <JourneyCanvas journey={sel} />
        </Card>
      </Reveal>
    </div>
  );
}

function JourneyRow({ j, selected, enabled, onSelect, onToggle }: { j: MktJourney; selected: boolean; enabled: boolean; onSelect: () => void; onToggle: (v: boolean) => void }) {
  const conv = (j.converted / j.enrolled) * 100;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn("relative mt-1.5 grid cursor-pointer grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_100px_100px_minmax(0,1.3fr)_120px_64px] items-center gap-4 rounded-[14px] border px-4 py-2.5 transition-all", selected ? "border-ember/40 bg-ember-soft/40" : "border-transparent hover:bg-surface-2/70")}
    >
      {selected && <motion.span layoutId="jr-sel" className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-ember" />}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={j.owner.photo} name={j.owner.name} size={28} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{j.name}</div>
          <div className="k-num text-[11.5px] text-fg-3">{fmtInt(j.active)} in journey now</div>
        </div>
      </div>
      <span className="truncate">
        <Chip size="sm" tone="ember">{j.trigger}</Chip>
      </span>
      <span className="k-num text-right text-[13px]">{fmtInt(j.enrolled)}</span>
      <span className="k-num text-right text-[13px]">{fmtInt(j.converted)}</span>
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <motion.div className={cn("h-full rounded-full", conv >= 40 ? "bg-up" : conv >= 20 ? "bg-gold" : "bg-warn")} initial={{ width: 0 }} animate={{ width: `${conv}%` }} transition={{ duration: 0.8 }} />
        </div>
        <span className={cn("k-num w-12 text-right text-[13px] font-semibold", conv >= 40 ? "text-up" : conv >= 20 ? "text-gold" : "text-warn")}>{conv.toFixed(1)}%</span>
      </div>
      <span className="k-num text-[12px] text-fg-3">{fmtDateTime(j.updated)}</span>
      <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <Toggle checked={enabled} onChange={onToggle} label={`Enable ${j.name}`} />
      </span>
    </div>
  );
}
