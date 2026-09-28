"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Download, Filter, Mail, Plus, RefreshCw, Save, Sparkles, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Delta, Input, Menu, PageHeader, Reveal, Segmented, Toggle, cn } from "@kalks/ui";
import { ADMIN_NOW, CLIENTS, SEGMENTS, SEGMENT_FIELDS, timeAgo, type AdminClient, type Segment, type SegmentCondition } from "@kalks/mock/admin-clients";

const TOTAL_USERS = 18_412;
const DAY = 86_400_000;

const OPS: Record<string, string[]> = {
  Country: ["in", "not in"],
  "KYC status": ["is", "is not"],
  "Net deposits": ["≥", "≤", "="],
  Equity: ["≥", "≤"],
  "Last login": ["within", "older than"],
  "Risk score": ["≥", "≤"],
  Group: ["is", "is not"],
  Tag: ["has", "has not"],
  Desk: ["is"],
  Source: ["is"],
  "Lifetime lots": ["≥", "≤"],
  Registered: ["within", "older than"],
};
const DEFAULT_VAL: Record<string, string> = {
  Country: "AE, SA",
  "KYC status": "Verified",
  "Net deposits": "$1,000",
  Equity: "$500",
  "Last login": "7 days",
  "Risk score": "7",
  Group: "Pro",
  Tag: "VIP",
  Desk: "Sales · EN",
  Source: "Google Ads",
  "Lifetime lots": "10",
  Registered: "30 days",
};

const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const kycMap: Record<string, string> = { verified: "verified", pending: "pending", rejected: "rejected", "in review": "review", "not started": "none" };

function evalCond(c: AdminClient, k: SegmentCondition): boolean {
  const v = k.value.toLowerCase();
  const cmp = (x: number) => (k.op === "≥" ? x >= num(k.value) : k.op === "≤" ? x <= num(k.value) : k.op === "=" ? x === num(k.value) : true);
  switch (k.field) {
    case "Country": {
      const list = v.split(/[,\s]+/).filter(Boolean);
      return k.op === "in" ? list.includes(c.country) : !list.includes(c.country);
    }
    case "KYC status":
      return (c.kyc === (kycMap[v] ?? v)) === (k.op === "is");
    case "Net deposits":
      return cmp(c.net);
    case "Equity":
      return cmp(c.equity);
    case "Risk score":
      return cmp(c.risk);
    case "Lifetime lots":
      return cmp(c.lifetimeLots);
    case "Last login":
    case "Registered": {
      const t = Date.parse(k.field === "Last login" ? c.lastLogin : c.registered);
      const days = num(k.value);
      return k.op === "within" ? ADMIN_NOW - t <= days * DAY : ADMIN_NOW - t > days * DAY;
    }
    case "Group":
      return (c.group.toLowerCase() === v) === (k.op === "is");
    case "Tag":
      return c.tags.some((t) => t.toLowerCase() === v) === (k.op === "has");
    case "Desk":
      return c.desk.toLowerCase() === v;
    case "Source":
      return c.source.toLowerCase() === v;
    default:
      return true;
  }
}

function segCount(s: Segment) {
  const n = CLIENTS.filter((c) => (s.match === "all" ? s.conditions.every((k) => evalCond(c, k)) : s.conditions.some((k) => evalCond(c, k)))).length;
  return Math.round((n / CLIENTS.length) * TOTAL_USERS);
}

const COLOR: Record<Segment["color"], string> = { ember: "bg-ember", gold: "bg-gold", up: "bg-up", down: "bg-down", info: "bg-info", warn: "bg-warn" };

function ConditionChip({ c, onChange, onRemove }: { c: SegmentCondition; onChange: (c: SegmentCondition) => void; onRemove: () => void }) {
  const [edit, setEdit] = React.useState(false);
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-1 rounded-full border border-ember/30 bg-ember-soft py-1 pl-3 pr-1 text-[12.5px]">
      <span className="font-medium">{c.field}</span>
      <Menu
        width={160}
        items={(OPS[c.field] ?? ["is"]).map((o) => ({ label: o, onSelect: () => onChange({ ...c, op: o }) }))}
        trigger={<button className="rounded-md px-1.5 font-mono text-ember hover:bg-ember/15">{c.op}</button>}
      />
      {edit ? (
        <input
          autoFocus
          defaultValue={c.value}
          onBlur={(e) => {
            onChange({ ...c, value: e.target.value });
            setEdit(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-24 rounded-md bg-surface-2 px-1.5 font-mono text-[12px] outline-none"
        />
      ) : (
        <button onClick={() => setEdit(true)} className="rounded-md px-1.5 font-mono text-[12px] text-fg hover:bg-ember/15">
          {c.value}
        </button>
      )}
      <button onClick={onRemove} className="grid size-5 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Remove condition">
        <X className="size-3" />
      </button>
    </motion.div>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = React.useState(SEGMENTS);
  const [active, setActive] = React.useState<string | null>(SEGMENTS[0]!.id);
  const [name, setName] = React.useState(SEGMENTS[0]!.name);
  const [conds, setConds] = React.useState<SegmentCondition[]>(SEGMENTS[0]!.conditions);
  const [match, setMatch] = React.useState<"all" | "any">(SEGMENTS[0]!.match);
  const [auto, setAuto] = React.useState(true);

  const load = (s: Segment) => {
    setActive(s.id);
    setName(s.name);
    setConds(s.conditions);
    setMatch(s.match);
    setAuto(s.auto);
  };
  const matched = React.useMemo(
    () => (conds.length ? CLIENTS.filter((c) => (match === "all" ? conds.every((k) => evalCond(c, k)) : conds.some((k) => evalCond(c, k)))) : CLIENTS),
    [conds, match],
  );
  const est = Math.round((matched.length / CLIENTS.length) * TOTAL_USERS);
  const equity = matched.reduce((s, c) => s + c.equity, 0);

  return (
    <div className="pb-10">
      <PageHeader
        title="Segments"
        subtitle="Saved audiences with live rules — use them for campaigns, desk routing and bulk actions."
        actions={
          <Button
            variant="ember"
            size="lg"
            onClick={() => {
              setActive(null);
              setName("Untitled segment");
              setConds([{ field: "KYC status", op: "is", value: "Verified" }]);
              setMatch("all");
            }}
          >
            <Plus /> New segment
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-5">
          <Card>
            <CardHeader title="Saved segments" subtitle={`${segments.length} segments · ${segments.filter((s) => s.auto).length} auto-refreshing`} icon={<Users />} />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {segments.map((s) => (
                <button key={s.id} onClick={() => load(s)} className={cn("k-row relative flex w-full items-start gap-3 overflow-hidden px-4 py-3 text-left transition-colors hover:bg-surface-3/60", active === s.id && "border-ember/40 bg-ember-soft")}>
                  <span className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", COLOR[s.color])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium">{s.name}</span>
                      {s.auto && (
                        <Chip size="sm" tone="info">
                          <RefreshCw className="size-2.5" /> Auto
                        </Chip>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-fg-3">{s.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.conditions.map((c, i) => (
                        <span key={i} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">
                          {c.field} {c.op} {c.value}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="k-num text-[18px] font-semibold">{segCount(s).toLocaleString()}</div>
                    <Delta value={s.trend} className="text-[11px]" />
                    <div className="mt-1 text-[10.5px] text-fg-3">{s.owner.split(" ")[0]} · {timeAgo(s.updated)}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.08} className="xl:col-span-7">
          <Card hot className="overflow-hidden">
            <div className="relative px-6 pb-6 pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
                  <Filter className="size-4" />
                </span>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 flex-1 bg-black/20 text-[15px] font-medium" />
                <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
                  <Toggle checked={auto} onChange={setAuto} label="Auto refresh" /> Auto-refresh
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
                Match
                <Segmented size="xs" value={match} onChange={setMatch} options={[{ value: "all", label: "ALL" }, { value: "any", label: "ANY" }]} />
                of these conditions
              </div>

              <div className="mt-3 flex min-h-[64px] flex-wrap items-center gap-2 rounded-[16px] border border-dashed border-white/15 bg-black/20 p-3">
                <AnimatePresence initial={false}>
                  {conds.map((c, i) => (
                    <React.Fragment key={`${c.field}-${i}`}>
                      {i > 0 && <span className="font-mono text-[10.5px] font-semibold text-fg-3">{match === "all" ? "AND" : "OR"}</span>}
                      <ConditionChip c={c} onChange={(n) => setConds((xs) => xs.map((x, k) => (k === i ? n : x)))} onRemove={() => setConds((xs) => xs.filter((_, k) => k !== i))} />
                    </React.Fragment>
                  ))}
                </AnimatePresence>
                <Menu
                  align="start"
                  width={210}
                  header={<div className="text-[11px] uppercase tracking-wider text-fg-3">Add condition</div>}
                  items={SEGMENT_FIELDS.map((f) => ({ label: f, onSelect: () => setConds((xs) => [...xs, { field: f, op: OPS[f]![0]!, value: DEFAULT_VAL[f]! }]) }))}
                  trigger={
                    <button className="flex h-8 items-center gap-1 rounded-full border border-dashed border-fg-3/60 px-3 text-[12px] text-fg-2 hover:border-ember hover:text-ember">
                      <Plus className="size-3.5" /> Condition
                    </button>
                  }
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <div className="k-label">Matching clients</div>
                  <motion.div key={est} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="k-num mt-2 text-[38px] font-semibold leading-none">
                    {est.toLocaleString()}
                  </motion.div>
                  <div className="mt-1.5 text-[12px] text-fg-3">
                    {((matched.length / CLIENTS.length) * 100).toFixed(1)}% of {TOTAL_USERS.toLocaleString()} users
                  </div>
                </div>
                <div>
                  <div className="k-label">Combined equity</div>
                  <div className="k-num mt-2 text-[22px] font-semibold">${Math.round((equity / CLIENTS.length) * TOTAL_USERS / 1000).toLocaleString()}k</div>
                  <div className="mt-1 text-[12px] text-fg-3">estimated</div>
                </div>
                <div>
                  <div className="k-label">Preview</div>
                  <div className="mt-2 flex -space-x-2">
                    {matched.slice(0, 7).map((c) => (
                      <Link key={c.id} href={`/clients/${c.id}`}>
                        <Avatar src={c.photo} name={c.name} size={32} className="ring-2 ring-[#1a0f0a]" />
                      </Link>
                    ))}
                    {matched.length > 7 && <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-[10.5px] ring-2 ring-[#1a0f0a]">+{matched.length - 7}</span>}
                  </div>
                  <div className="mt-1.5 truncate text-[12px] text-fg-3">{matched.slice(0, 3).map((c) => c.name.split(" ")[0]).join(", ") || "No matches"}</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <Button
                  variant="ember"
                  size="sm"
                  onClick={() => {
                    if (active) {
                      setSegments((xs) => xs.map((s) => (s.id === active ? { ...s, name, conditions: conds, match, auto, count: est, updated: new Date(ADMIN_NOW).toISOString() } : s)));
                      toast.success(`“${name}” saved`, { description: `${est.toLocaleString()} clients` });
                    } else {
                      const id = `SEG-${segments.length + 1}`;
                      setSegments((xs) => [{ id, name, description: "Custom segment", conditions: conds, match, auto, count: est, trend: 0, owner: "Priya Nair", updated: new Date(ADMIN_NOW).toISOString(), color: "ember" }, ...xs]);
                      setActive(id);
                      toast.success(`Segment “${name}” created`, { description: `${est.toLocaleString()} clients` });
                    }
                  }}
                >
                  <Save /> Save segment
                </Button>
                <Menu
                  items={[
                    { label: "Send email campaign", icon: <Mail />, onSelect: () => toast.success(`Campaign draft created for ${est.toLocaleString()} clients`, { description: "Marketing → Campaigns" }) },
                    { label: "Assign to desk", icon: <Users />, onSelect: () => toast.success(`${est.toLocaleString()} clients queued for round-robin`) },
                    { label: "Trigger automation", icon: <Zap />, onSelect: () => toast.success("Automation “Win-back 3-step” attached") },
                  ]}
                  trigger={
                    <Button variant="surface" size="sm">
                      <Sparkles /> Bulk action
                    </Button>
                  }
                />
                <Button variant="surface" size="sm" onClick={() => toast.success(`${name.toLowerCase().replace(/\s+/g, "-")}.csv exported`, { description: `${est.toLocaleString()} rows` })}>
                  <Download /> Export
                </Button>
              </div>
            </div>
          </Card>
          <Card className="mt-4">
            <CardHeader title="Matches" subtitle="Live sample from the rule" />
            <div className="mt-3 divide-y divide-line px-6 pb-4">
              {matched.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center gap-3 py-2.5 hover:text-ember">
                  <Avatar src={c.photo} name={c.name} size={26} />
                  <span className="flex-1 text-[13px]">{c.name}</span>
                  <span className="text-[12px] text-fg-3">{c.group}</span>
                  <span className="k-num w-24 text-right font-mono text-[12px]">${Math.round(c.net).toLocaleString()}</span>
                  <span className="w-20 text-right text-[11.5px] text-fg-3">{timeAgo(c.lastLogin)}</span>
                </Link>
              ))}
              {matched.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">No clients match — loosen a condition.</div>}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
