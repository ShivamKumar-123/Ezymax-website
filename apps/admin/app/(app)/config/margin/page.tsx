"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Ban, CalendarClock, Lock, Newspaper, Pencil, Plus, ShieldAlert, Sun, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, Flag, IconButton, PageHeader, Reveal, Segmented, SymbolCell, Toggle, cn, formatDateTime, type ChipTone } from "@ezymex/ui";
import { INSTRUMENTS } from "@ezymex/mock";
import { BLACKOUTS, MARGIN_SCHEDULES, RESTRICTIONS, type BlackoutWindow, type MarginSchedule, type SymbolRestriction } from "@ezymex/mock/admin-config";
import { MiniField, MiniStat, NumInput, Select, TextInput, auditToast, useReason } from "@/components/config/kit";

const KIND: Record<MarginSchedule["kind"], { label: string; tone: ChipTone; icon: React.ReactNode }> = {
  weekend: { label: "Weekend", tone: "info", icon: <Sun /> },
  holiday: { label: "Holiday", tone: "gold", icon: <CalendarClock /> },
  news: { label: "News", tone: "down", icon: <Newspaper /> },
};
const ACTION: Record<BlackoutWindow["action"], { label: string; tone: ChipTone }> = {
  "block-new": { label: "Block new orders", tone: "down" },
  "close-only": { label: "Close-only", tone: "warn" },
  widen: { label: "Widen spread ×2", tone: "gold" },
  "no-pending": { label: "Freeze pending", tone: "info" },
};

function Timeline({ s }: { s: MarginSchedule }) {
  const max = Math.max(...s.timeline.map((t) => t.mult), 1);
  return (
    <div className="mt-4">
      <div className="relative h-16 overflow-hidden rounded-[12px] border border-line bg-surface-2">
        <div className="k-dotgrid absolute inset-0 opacity-50" />
        {/* 1× baseline */}
        <div className="absolute inset-x-0 border-t border-dashed border-fg-3/40" style={{ bottom: `${(1 / (max + 0.5)) * 100}%` }} />
        {s.timeline.map((t, i) => (
          <motion.div
            key={i}
            className={cn("absolute bottom-0 rounded-t-[6px] border-t-2", s.kind === "news" ? "border-down bg-down/25" : s.kind === "holiday" ? "border-gold bg-gold/20" : "border-ember bg-ember/20")}
            style={{ left: `${(t.from / s.span) * 100}%`, width: `${((t.to - t.from) / s.span) * 100}%` }}
            initial={{ height: 0 }}
            animate={{ height: `${(t.mult / (max + 0.5)) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {(t.to - t.from) / s.span > 0.08 && <span className="absolute left-1.5 top-1 font-mono text-[10.5px] font-semibold text-fg">{t.mult}×</span>}
          </motion.div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-fg-3">
        {s.axis.map((a) => (
          <span key={a}>{a}</span>
        ))}
      </div>
    </div>
  );
}

function ScheduleCard({ s, onToggle, onEdit }: { s: MarginSchedule; onToggle: (v: boolean) => void; onEdit: () => void }) {
  const k = KIND[s.kind];
  return (
    <Card className={cn("flex h-full flex-col", !s.active && "opacity-70")}>
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border [&_svg]:size-4", s.kind === "news" ? "border-down/30 bg-down-soft text-down" : s.kind === "holiday" ? "border-gold/30 bg-gold-soft text-gold" : "border-info/30 bg-info-soft text-info")}>{k.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-medium">{s.name}</h3>
            {!s.active && <Chip size="sm" tone="warn">Draft</Chip>}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px] text-fg-3">
            {s.start} → {s.end}
          </div>
        </div>
        <div className="text-right">
          <div className="k-num text-[24px] font-semibold leading-none text-ember">{s.multiplier}×</div>
          <div className="mt-1 text-[10.5px] uppercase tracking-wider text-fg-3">margin</div>
        </div>
      </div>
      <div className="px-5">
        <Timeline s={s} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1 px-5">
        {s.appliesTo.map((a) => (
          <span key={a} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">
            {a}
          </span>
        ))}
      </div>
      <p className="mt-3 px-5 text-[12px] text-fg-3">{s.note}</p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-5 py-3 mt-4">
        <div className="text-[11.5px] text-fg-3">
          Next <span className="text-fg-2">{formatDateTime(s.nextRun)}</span> · <span className="k-num">{s.affectedAccounts.toLocaleString()}</span> accounts
        </div>
        <div className="flex items-center gap-2">
          <IconButton size="sm" onClick={onEdit} aria-label="Edit schedule">
            <Pencil />
          </IconButton>
          <Toggle checked={s.active} onChange={onToggle} label="Active" />
        </div>
      </div>
    </Card>
  );
}

function ScheduleDialog({ s, open, onOpenChange, onSave }: { s: MarginSchedule | null; open: boolean; onOpenChange: (o: boolean) => void; onSave: (s: MarginSchedule) => void }) {
  const [d, setD] = React.useState<MarginSchedule | null>(s);
  React.useEffect(() => {
    if (open) setD(s);
  }, [open, s]);
  if (!d) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={s?.id === "new" ? "New margin schedule" : `Edit · ${s?.name}`}
      description="Existing positions are re-margined when the window starts; margin calls are evaluated immediately."
      width={560}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="ember"
            onClick={() => {
              onSave(d);
              auditToast(`Margin schedule “${d.name}” saved`, `${d.multiplier}× · ${d.start} → ${d.end}`);
              onOpenChange(false);
            }}
          >
            Save schedule
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <MiniField label="Name" className="col-span-2">
          <TextInput value={d.name} onChange={(v) => setD({ ...d, name: v })} />
        </MiniField>
        <MiniField label="Type">
          <Select value={d.kind} onChange={(v) => setD({ ...d, kind: v })} options={[{ value: "weekend", label: "Weekend" }, { value: "holiday", label: "Holiday" }, { value: "news", label: "News event" }]} />
        </MiniField>
        <MiniField label="Multiplier">
          <NumInput value={d.multiplier} onChange={(v) => setD({ ...d, multiplier: v })} step={0.25} min={1} max={10} suffix="×" stepper />
        </MiniField>
        <MiniField label="Starts (server time)">
          <TextInput value={d.start} onChange={(v) => setD({ ...d, start: v })} mono />
        </MiniField>
        <MiniField label="Ends">
          <TextInput value={d.end} onChange={(v) => setD({ ...d, end: v })} mono />
        </MiniField>
        <MiniField label="Ramp-in before start">
          <NumInput value={d.rampMin} onChange={(v) => setD({ ...d, rampMin: v })} suffix="min" min={0} />
        </MiniField>
        <MiniField label="Applies to">
          <TextInput value={d.appliesTo.join(", ")} onChange={(v) => setD({ ...d, appliesTo: v.split(",").map((x) => x.trim()).filter(Boolean) })} />
        </MiniField>
      </div>
    </Dialog>
  );
}

function RestrictionDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (r: SymbolRestriction) => void }) {
  const [symbol, setSymbol] = React.useState("GBPJPY");
  const [mode, setMode] = React.useState<SymbolRestriction["mode"]>("close-only");
  const [reason, setReason] = React.useState("LP liquidity reduced");
  const [until, setUntil] = React.useState("2026-09-25 23:00");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Restrict a symbol"
      description="Takes effect on the next order across all groups. Clients see a banner in the terminal."
      width={500}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="sell"
            onClick={() => {
              onAdd({ id: `r${Date.now()}`, symbol, mode, reason, since: "2026-09-24T10:00:00Z", until: until ? until.replace(" ", "T") + ":00Z" : undefined, by: "Priya Nair", openPositions: 214 });
              auditToast(`${symbol} set to ${mode}`, reason);
              onOpenChange(false);
            }}
          >
            Apply restriction
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Symbol">
            <Select value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => i.symbol)} />
          </MiniField>
          <MiniField label="Until (GMT+3)" hint="Blank = manual">
            <TextInput value={until} onChange={setUntil} mono />
          </MiniField>
        </div>
        <Segmented value={mode} onChange={setMode} options={[{ value: "close-only", label: "Close-only" }, { value: "long-only", label: "Long-only" }, { value: "suspended", label: "Suspended" }]} />
        <MiniField label="Reason (shown to staff)">
          <Select value={reason} onChange={setReason} options={["LP liquidity reduced", "Corporate action pending", "Regulatory review", "Abnormal volatility", "Short borrow unavailable", "Feed outage"]} />
        </MiniField>
      </div>
    </Dialog>
  );
}

export default function MarginPage() {
  const [schedules, setSchedules] = React.useState(MARGIN_SCHEDULES);
  const [blackouts, setBlackouts] = React.useState(BLACKOUTS);
  const [restrictions, setRestrictions] = React.useState(RESTRICTIONS);
  const [editing, setEditing] = React.useState<MarginSchedule | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [addR, setAddR] = React.useState(false);
  const reason = useReason();

  const newSchedule = (): MarginSchedule => ({
    id: "new", name: "New schedule", kind: "news", multiplier: 2, start: "Thu 1 Oct 15:15", end: "15:45", rampMin: 15, appliesTo: ["EURUSD", "XAUUSD"],
    nextRun: "2026-10-01T12:15:00Z", active: false, affectedAccounts: 0, note: "Draft schedule.", timeline: [{ from: 0.25, to: 0.75, mult: 2 }], span: 1, axis: ["15:00", "15:30", "16:00"],
  });

  return (
    <div className="pb-16">
      <PageHeader
        title="Margin schedules"
        subtitle="Dynamic margin for weekends, holidays and high-impact news — plus blackout windows and restricted symbols."
        actions={
          <Button
            variant="ember"
            onClick={() => {
              setEditing(newSchedule());
              setEditOpen(true);
            }}
          >
            <Plus /> New schedule
          </Button>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Active schedules" value={schedules.filter((s) => s.active).length} sub={`${schedules.length - schedules.filter((s) => s.active).length} draft`} />
          <MiniStat label="Next window" value="Fri 21:00" sub="Weekend 2× · in 1d 7h" tone="ember" />
          <MiniStat label="Accounts at risk of MC" value="312" sub="If weekend 2× applied now" tone="warn" />
          <MiniStat label="Restricted symbols" value={restrictions.length} sub="Close-only / long-only / suspended" tone="down" />
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {schedules.map((s, i) => (
          <Reveal key={s.id} delay={0.04 * i}>
            <ScheduleCard
              s={s}
              onEdit={() => {
                setEditing(s);
                setEditOpen(true);
              }}
              onToggle={(v) => {
                setSchedules((p) => p.map((x) => (x.id === s.id ? { ...x, active: v } : x)));
                auditToast(`${s.name} ${v ? "activated" : "deactivated"}`);
              }}
            />
          </Reveal>
        ))}
        <Reveal delay={0.2}>
          <button
            onClick={() => {
              setEditing(newSchedule());
              setEditOpen(true);
            }}
            className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-line text-fg-3 transition-colors hover:border-ember/40 hover:bg-ember-soft/40 hover:text-fg"
          >
            <span className="grid size-11 place-items-center rounded-full border border-line bg-surface-2">
              <Plus className="size-4" />
            </span>
            <span className="text-[13.5px] font-medium">Add margin schedule</span>
            <span className="max-w-60 text-center text-[12px]">Weekend, holiday or news window with ramp-in and per-symbol scope</span>
          </button>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="News blackout windows" subtitle="Minutes before / after the release · server time GMT+3" icon={<ShieldAlert />} action={<Chip tone="down" dot>{blackouts.filter((b) => b.enabled).length} armed</Chip>} />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {blackouts.map((b) => (
                <div key={b.id} className={cn("k-row relative flex flex-wrap items-center gap-3 overflow-hidden py-2.5 pl-5 pr-4", !b.enabled && "opacity-55")}>
                  <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", b.impact === 3 ? "bg-down" : "bg-warn")} />
                  <div className="w-24 shrink-0">
                    <div className="font-mono text-[12px] text-fg">{formatDateTime(b.time, { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="text-[11px] text-fg-3">{formatDateTime(b.time, { weekday: "short", day: "2-digit", month: "short" })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      <Flag country={b.country} className="size-4" />
                      <span className="truncate">{b.event}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10.5px] text-fg-3">{b.symbols.join(" · ")}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <NumInput size="sm" value={b.before} onChange={(v) => setBlackouts((p) => p.map((x) => (x.id === b.id ? { ...x, before: v } : x)))} prefix="−" suffix="m" className="h-7 w-[68px]" min={0} />
                    <NumInput size="sm" value={b.after} onChange={(v) => setBlackouts((p) => p.map((x) => (x.id === b.id ? { ...x, after: v } : x)))} prefix="+" suffix="m" className="h-7 w-[68px]" min={0} />
                  </div>
                  <Select<BlackoutWindow["action"]>
                    size="sm"
                    className="w-40"
                    value={b.action}
                    onChange={(v) => {
                      setBlackouts((p) => p.map((x) => (x.id === b.id ? { ...x, action: v } : x)));
                      auditToast(`${b.event}: ${ACTION[v].label}`);
                    }}
                    options={(Object.keys(ACTION) as BlackoutWindow["action"][]).map((a) => ({ value: a, label: ACTION[a].label }))}
                  />
                  <Toggle
                    checked={b.enabled}
                    onChange={(v) => {
                      setBlackouts((p) => p.map((x) => (x.id === b.id ? { ...x, enabled: v } : x)));
                      auditToast(`Blackout ${v ? "armed" : "disarmed"} · ${b.event}`);
                    }}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader
              title="Close-only & suspended"
              subtitle="Symbols with restricted trading right now"
              icon={<Lock />}
              action={
                <Button size="sm" variant="surface" onClick={() => setAddR(true)}>
                  <Plus /> Restrict
                </Button>
              }
            />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {restrictions.map((r) => (
                <div key={r.id} className="k-row px-4 py-3">
                  <div className="flex items-center gap-3">
                    <SymbolCell symbol={r.symbol} size={26} sub={r.reason} className="min-w-0 flex-1" />
                    <Chip size="sm" tone={r.mode === "suspended" ? "down" : r.mode === "close-only" ? "warn" : "info"} dot>
                      {r.mode === "suspended" ? <Ban className="size-3" /> : null}
                      {r.mode}
                    </Chip>
                    <IconButton
                      size="sm"
                      aria-label="Lift restriction"
                      onClick={() =>
                        reason.ask({
                          title: `Lift restriction on ${r.symbol}?`,
                          description: "Full trading resumes immediately for all groups.",
                          reasons: ["Liquidity restored", "Review completed", "Set in error", "Corporate action settled"],
                          confirmLabel: "Lift restriction",
                          onConfirm: (why) => {
                            setRestrictions((p) => p.filter((x) => x.id !== r.id));
                            auditToast(`${r.symbol} restriction lifted`, why);
                          },
                        })
                      }
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-3">
                    <span>Since {formatDateTime(r.since)}</span>
                    <span>{r.until ? `Until ${formatDateTime(r.until)}` : "Until lifted manually"}</span>
                    <span className="k-num">{r.openPositions.toLocaleString()} open positions</span>
                    <span>by {r.by}</span>
                  </div>
                </div>
              ))}
              <div className="mt-3 rounded-[14px] border border-down/25 bg-down-soft p-4">
                <div className="flex items-start gap-3">
                  <Ban className="mt-0.5 size-4 shrink-0 text-down" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">Market-wide close-only</div>
                    <div className="mt-0.5 text-[12px] text-fg-3">Emergency switch for feed outages or extreme events. Rejects every new order on all {INSTRUMENTS.length} symbols; closing is still allowed.</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="down-outline"
                  className="mt-3 w-full"
                  onClick={() =>
                    reason.ask({
                      title: "Switch ALL symbols to close-only?",
                      description: "Affects every group and server. Requires Head of Dealing sign-off within 15 minutes.",
                      reasons: ["LP / feed outage", "Extreme volatility event", "Regulatory instruction", "Platform incident"],
                      confirmLabel: "Activate close-only",
                      tone: "sell",
                      onConfirm: (why) => auditToast("Market-wide close-only activated", why),
                    })
                  }
                >
                  Activate market-wide close-only
                </Button>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <ScheduleDialog
        s={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(ns) => setSchedules((p) => (ns.id === "new" ? [...p, { ...ns, id: `s${p.length + 1}` }] : p.map((x) => (x.id === ns.id ? ns : x))))}
      />
      <RestrictionDialog open={addR} onOpenChange={setAddR} onAdd={(r) => setRestrictions((p) => [r, ...p])} />
      {reason.node}
    </div>
  );
}
