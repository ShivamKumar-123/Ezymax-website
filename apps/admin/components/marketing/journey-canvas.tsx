"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  Clock,
  Copy,
  Gift,
  GitBranch,
  LogOut,
  Mail,
  Maximize2,
  MessageSquare,
  Minus,
  Plus,
  Shuffle,
  Smartphone,
  Tag,
  Target,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button, IconButton, Input, Tooltip, cn } from "@kalks/ui";
import type { MktJourney, MktNode, MktNodeKind } from "@kalks/mock/admin-growth-marketing";
import { fmtInt } from "./kit";

export const NODE_W = 196;
export const NODE_H = 112;
const CANVAS_W = 944 + NODE_W + 24;
const CANVAS_H = 432 + NODE_H + 24;

export const KIND: Record<MktNodeKind, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string; ring: string }> = {
  trigger: { label: "Trigger", icon: Zap, tone: "bg-ember-soft text-ember border-ember/30", ring: "var(--k-ember)" },
  wait: { label: "Wait", icon: Clock, tone: "bg-surface-3 text-fg-2 border-line", ring: "var(--k-fg-3)" },
  condition: { label: "Condition", icon: GitBranch, tone: "bg-warn-soft text-warn border-warn/30", ring: "var(--k-warn)" },
  email: { label: "Email", icon: Mail, tone: "bg-info-soft text-info border-info/30", ring: "var(--k-info)" },
  inapp: { label: "In-app", icon: MessageSquare, tone: "bg-gold-soft text-gold border-gold/30", ring: "var(--k-gold)" },
  sms: { label: "SMS", icon: Smartphone, tone: "bg-up-soft text-up border-up/30", ring: "var(--k-up)" },
  push: { label: "Push", icon: Bell, tone: "bg-info-soft text-info border-info/30", ring: "var(--k-info)" },
  bonus: { label: "Grant bonus", icon: Gift, tone: "bg-gold-soft text-gold border-gold/30", ring: "var(--k-gold)" },
  tag: { label: "Tag", icon: Tag, tone: "bg-surface-3 text-fg-2 border-line", ring: "var(--k-fg-3)" },
  goal: { label: "Goal", icon: Target, tone: "bg-up-soft text-up border-up/30", ring: "var(--k-up)" },
  exit: { label: "Exit", icon: LogOut, tone: "bg-surface-3 text-fg-3 border-line", ring: "var(--k-fg-3)" },
};

const PALETTE: { group: string; items: { kind: MktNodeKind; label: string; icon?: React.ComponentType<{ className?: string }> }[] }[] = [
  { group: "Triggers", items: [{ kind: "trigger", label: "Event trigger" }, { kind: "trigger", label: "Segment entry", icon: Users }] },
  { group: "Flow", items: [{ kind: "wait", label: "Wait / delay" }, { kind: "condition", label: "Condition" }, { kind: "condition", label: "A/B split", icon: Shuffle }] },
  { group: "Actions", items: [{ kind: "email", label: "Email" }, { kind: "inapp", label: "In-app message" }, { kind: "sms", label: "SMS" }, { kind: "push", label: "Push" }, { kind: "bonus", label: "Grant bonus" }, { kind: "tag", label: "Add tag" }] },
  { group: "Outcomes", items: [{ kind: "goal", label: "Goal" }, { kind: "exit", label: "Exit" }] },
];

function bez(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(40, (x2 - x1) * 0.5);
  const c1x = x1 + dx;
  const c2x = x2 - dx;
  return {
    d: `M${x1},${y1} C${c1x},${y1} ${c2x},${y2} ${x2},${y2}`,
    mid: { x: (x1 + 3 * c1x + 3 * c2x + x2) / 8, y: (y1 + 3 * y1 + 3 * y2 + y2) / 8 },
  };
}

export function JourneyCanvas({ journey }: { journey: MktJourney }) {
  const [selId, setSelId] = React.useState<string | null>("n_cond");
  const [zoom, setZoom] = React.useState(1);
  const [fit, setFit] = React.useState(1);
  const wrap = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    setSelId("n_cond");
    setZoom(1);
  }, [journey.id]);
  React.useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.min(1, (el.clientWidth - 32) / CANVAS_W, (el.clientHeight - 32) / CANVAS_H)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = fit * zoom;
  const byId = Object.fromEntries(journey.nodes.map((n) => [n.id, n]));
  const sel = selId ? byId[selId] : undefined;

  return (
    <div className="grid grid-cols-1 border-t border-line lg:grid-cols-[62px_1fr] 2xl:grid-cols-[62px_1fr_300px]">
      {/* Palette */}
      <aside className="flex flex-wrap items-center gap-1.5 border-b border-line p-2.5 lg:flex-col lg:flex-nowrap lg:border-b-0 lg:border-r">
        <span className="mb-0.5 hidden text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fg-3 lg:block">Add</span>
        {PALETTE.map((g, gi) => (
          <React.Fragment key={g.group}>
            {gi > 0 && <span className="mx-1 h-6 w-px bg-line lg:mx-0 lg:my-1 lg:h-px lg:w-7" />}
            {g.items.map((it) => {
              const k = KIND[it.kind];
              const Icon = it.icon ?? k.icon;
              return (
                <Tooltip key={it.label} content={`${g.group} · ${it.label}`} side="right">
                  <button
                    type="button"
                    aria-label={`Add ${it.label}`}
                    onClick={() => toast.success(`${it.label} node added`, { description: `Placed after "${sel?.title ?? "Trigger"}" — drag to connect` })}
                    className={cn("grid size-10 shrink-0 place-items-center rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)] [&_svg]:size-4", k.tone)}
                  >
                    <Icon />
                  </button>
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </aside>

      {/* Canvas */}
      <div className="relative min-w-0">
        <div ref={wrap} className="k-dotgrid relative h-[560px] overflow-auto" onClick={() => setSelId(null)}>
          <div style={{ width: CANVAS_W * scale + 32, height: CANVAS_H * scale + 32 }} className="relative mx-auto">
            <div className="absolute left-4 top-4 origin-top-left transition-transform duration-300" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}>
              <svg width={CANVAS_W} height={CANVAS_H} className="pointer-events-none absolute inset-0 overflow-visible">
                <defs>
                  <marker id="mkt-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="var(--k-fg-3)" />
                  </marker>
                </defs>
                {journey.edges.map((e, i) => {
                  const a = byId[e.from]!;
                  const b = byId[e.to]!;
                  const { d } = bez(a.x + NODE_W, a.y + NODE_H / 2, b.x - 4, b.y + NODE_H / 2);
                  const hot = selId === e.from || selId === e.to;
                  const no = e.label === "No";
                  return (
                    <g key={`${e.from}-${e.to}`}>
                      <motion.path d={d} fill="none" stroke={hot ? "var(--k-ember)" : "var(--k-border-top)"} strokeWidth={hot ? 2 : 1.5} markerEnd="url(#mkt-arrow)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 + i * 0.05 }} />
                      <path d={d} fill="none" stroke={no ? "var(--k-fg-3)" : "var(--k-ember)"} strokeOpacity={hot ? 1 : 0.55} strokeWidth={2} strokeDasharray="4 10" strokeLinecap="round" className="mkt-flow" />
                    </g>
                  );
                })}
              </svg>
              {journey.edges
                .filter((e) => e.label)
                .map((e) => {
                  const a = byId[e.from]!;
                  const b = byId[e.to]!;
                  const { mid } = bez(a.x + NODE_W, a.y + NODE_H / 2, b.x, b.y + NODE_H / 2);
                  return (
                    <span
                      key={`l-${e.to}`}
                      className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", e.label === "Yes" ? "border-up/30 bg-[color-mix(in_oklab,var(--k-surface)_80%,var(--k-up))] text-up" : "border-line bg-surface-2 text-fg-2")}
                      style={{ left: mid.x, top: mid.y }}
                    >
                      {e.label}
                    </span>
                  );
                })}
              {journey.nodes.map((n, i) => (
                <NodeCard key={`${journey.id}-${n.id}`} n={n} i={i} selected={n.id === selId} onSelect={() => setSelId(n.id)} />
              ))}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-surface/90 p-1 backdrop-blur">
            <IconButton size="sm" className="size-7 border-0 bg-transparent" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Zoom out">
              <Minus />
            </IconButton>
            <span className="k-num w-11 text-center text-[11.5px] text-fg-2">{Math.round(scale * 100)}%</span>
            <IconButton size="sm" className="size-7 border-0 bg-transparent" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Zoom in">
              <Plus />
            </IconButton>
            <IconButton size="sm" className="size-7 border-0 bg-transparent" onClick={() => setZoom(1)} aria-label="Fit to screen">
              <Maximize2 />
            </IconButton>
          </div>
          <div className="hidden items-center gap-3 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-[11px] text-fg-3 backdrop-blur sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-ember text-ember" /> Live flow
            </span>
            <span className="k-num">{fmtInt(journey.active)} clients in journey</span>
          </div>
        </div>
      </div>

      {/* Inspector */}
      <aside className="border-t border-line lg:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
        <AnimatePresence mode="wait">
          {sel ? <Inspector key={sel.id + journey.id} n={sel} onClose={() => setSelId(null)} /> : <EmptyInspector key="empty" j={journey} />}
        </AnimatePresence>
      </aside>
      <style>{`@keyframes mkt-flow{to{stroke-dashoffset:-28}}.mkt-flow{animation:mkt-flow 1.1s linear infinite}`}</style>
    </div>
  );
}

function NodeCard({ n, i, selected, onSelect }: { n: MktNode; i: number; selected: boolean; onSelect: () => void }) {
  const k = KIND[n.kind];
  const Icon = k.icon;
  const pct = n.entered ? (n.passed / n.entered) * 100 : 0;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "k-card absolute flex flex-col rounded-[16px] px-3 pb-2.5 pt-2.5 text-left transition-[box-shadow,border-color] hover:border-[var(--k-border-top)]",
        selected && "border-ember/60",
      )}
      style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H, boxShadow: selected ? `0 0 0 3px color-mix(in oklab, ${k.ring} 25%, transparent), 0 18px 40px -18px ${k.ring}` : undefined }}
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-lg border [&_svg]:size-3.5", k.tone)}>
          <Icon />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{k.label}</span>
        {n.kind === "trigger" && <span className="ml-auto size-1.5 animate-pulse-dot rounded-full bg-ember text-ember" />}
      </div>
      <div className="mt-1.5 truncate text-[13px] font-medium leading-tight text-fg">{n.title}</div>
      <div className="mt-0.5 truncate text-[11px] text-fg-3">{n.detail}</div>
      <div className="mt-auto flex items-center gap-2 text-[10.5px]">
        <span className="k-num text-fg-2">{fmtInt(n.entered)}</span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: k.ring }} />
        </span>
        <span className="k-num text-fg">{fmtInt(n.passed)}</span>
      </div>
    </motion.button>
  );
}

function Inspector({ n, onClose }: { n: MktNode; onClose: () => void }) {
  const k = KIND[n.kind];
  const Icon = k.icon;
  const [title, setTitle] = React.useState(n.title);
  const drop = n.entered - n.passed;
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }} className="flex h-full flex-col p-4">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border [&_svg]:size-4", k.tone)}>
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{k.label} node</div>
          <div className="truncate text-[14px] font-medium">{n.title}</div>
        </div>
        <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Close inspector">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Entered", fmtInt(n.entered), ""],
          ["Passed", fmtInt(n.passed), "text-up"],
          ["Drop-off", n.entered ? `${((drop / n.entered) * 100).toFixed(1)}%` : "—", drop > 0 ? "text-warn" : ""],
        ].map(([l, v, c]) => (
          <div key={l} className="k-row px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-[0.06em] text-fg-3">{l}</div>
            <div className={cn("k-num mt-0.5 text-[13.5px] font-medium", c)}>{v}</div>
          </div>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[12px] font-medium text-fg-2">Node name</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 text-[13px]" />
      </label>
      <div className="mt-4">
        <div className="k-label mb-2">Configuration</div>
        <dl className="k-row divide-y divide-line px-3">
          {n.config.map(([a, b]) => (
            <div key={a} className="flex items-start justify-between gap-3 py-2 text-[12px]">
              <dt className="shrink-0 text-fg-3">{a}</dt>
              <dd className={cn("text-right text-fg", /template|event|code|deep link/i.test(a) && "font-mono text-[11.5px]")}>{b}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-auto flex gap-2 pt-4">
        <Button size="sm" variant="ember" className="flex-1" onClick={() => toast.success("Node updated", { description: `${title} · journey saved as new version` })}>
          Apply
        </Button>
        <IconButton size="sm" aria-label="Duplicate node" onClick={() => toast.success(`${n.title} duplicated`)}>
          <Copy />
        </IconButton>
        <IconButton size="sm" aria-label="Delete node" onClick={() => toast.warning(`${n.title} removed`, { description: "Clients currently on this step will skip ahead" })}>
          <Trash2 />
        </IconButton>
      </div>
    </motion.div>
  );
}

function EmptyInspector({ j }: { j: MktJourney }) {
  const conv = (j.converted / j.enrolled) * 100;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
      <div className="k-label mb-3">Journey summary</div>
      <div className="k-row p-3 text-[12.5px]">
        <div className="text-fg-3">Trigger</div>
        <div className="font-medium">{j.trigger}</div>
        <div className="mt-2 text-fg-3">Goal</div>
        <div className="font-medium">{j.goal}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="k-row px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.06em] text-fg-3">Enrolled</div>
          <div className="k-num text-[14px] font-medium">{fmtInt(j.enrolled)}</div>
        </div>
        <div className="k-row px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.06em] text-fg-3">Conversion</div>
          <div className="k-num text-[14px] font-medium text-up">{conv.toFixed(1)}%</div>
        </div>
      </div>
      <p className="mt-4 text-[12px] text-fg-3">Select a node on the canvas to inspect its settings and step-level stats.</p>
    </motion.div>
  );
}
