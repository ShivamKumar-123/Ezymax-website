"use client";

import * as React from "react";
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, ExternalLink, PauseCircle, PlayCircle, RefreshCw, Server, Siren } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, PageHeader, Progress, Reveal, Segmented, Sparkline, SymbolAvatar, Tooltip, cn, formatNumber, useQuotes } from "@ezymex/ui";
import { serverTime, timeAgo } from "@ezymex/mock/admin-clients";
import { ERROR_RATE, FEED_STATUS, INCIDENTS, QUEUE_DEPTHS, SERVICES, type ServiceHealth } from "@ezymex/mock/admin-ops";
import { IntradayChart, ReasonDialog, SeverityChip, useTick } from "@/components/command/kit";

const STATUS = {
  healthy: { tone: "up", label: "Healthy", dot: "bg-up" },
  degraded: { tone: "warn", label: "Degraded", dot: "bg-warn" },
  down: { tone: "down", label: "Down", dot: "bg-down" },
} as const;

function jitter(name: string, n: number) {
  let h = n * 7919;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 0.9 + (h % 1000) / 5000;
}

function ServiceCard({ s, tick }: { s: ServiceHealth; tick: number }) {
  const p99 = s.p99 * jitter(s.name, tick);
  const series = [...s.series.slice(tick % 5), ...s.series.slice(0, tick % 5)];
  const st = STATUS[s.status];
  const over = p99 > s.slo;
  return (
    <Card className={cn("px-4 py-4 transition-colors hover:border-[var(--k-border-top)]", s.status !== "healthy" && "border-warn/30")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("relative size-2 shrink-0 rounded-full", st.dot)}>
            <span className={cn("absolute inset-0 animate-pulse-dot rounded-full", s.status === "healthy" ? "text-up" : "text-warn")} />
          </span>
          <span className="truncate font-mono text-[13px] font-medium">{s.name}</span>
        </span>
        <span className="text-fg-3 [&_svg]:size-3.5">{s.kind === "datastore" ? <Database /> : <Server />}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-fg-3">p99</div>
          <div className={cn("k-num font-mono text-[22px] font-semibold leading-tight", over ? "text-warn" : "text-fg")}>
            {p99 < 10 ? p99.toFixed(1) : Math.round(p99)}
            <span className="ml-0.5 text-[12px] font-normal text-fg-3">ms</span>
          </div>
        </div>
        <Sparkline data={series} width={76} height={30} tone={over ? "ember" : "up"} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-fg-3">
        <span>SLO {s.slo}ms</span>
        <span className="k-num">{s.rps ? `${formatNumber(Math.round(s.rps * jitter(s.name + "r", tick)), 0)} rps` : "idle"}</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[11px] text-fg-3">
        <Tooltip content={`Uptime 30d ${s.uptime}%`}>
          <span className="k-num">{s.uptime}%</span>
        </Tooltip>
        <span className="font-mono">{s.instances} · {s.version.split(" ")[0]}</span>
      </div>
    </Card>
  );
}

function FeedStatus() {
  const syms = FEED_STATUS.map((f) => f.symbol);
  const qs = useQuotes(syms);
  const n = useTick(500);
  const [start] = React.useState(() => Date.now());
  const [paused, setPaused] = React.useState<Record<string, boolean>>({ USOIL: true });
  const [target, setTarget] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "stale">("all");
  // Ages depend on the wall clock — render the static base ages on the server, go live after mount.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const now = mounted ? Date.now() : start;
  const rows = FEED_STATUS.map((f) => {
    if (!mounted) return { ...f, age: f.baseAge, stale: f.baseAge > 3000 };
    const phase = (n * 7 + f.symbol.charCodeAt(0) + f.symbol.length * 13) % 10;
    const live = now - (qs[f.symbol]?.time ?? now);
    const age = f.stale ? f.baseAge + (now - start) : Math.max(12, Math.min(f.baseAge * (0.35 + phase / 10), live + 20));
    return { ...f, age, stale: age > 3000 };
  });
  const list = filter === "stale" ? rows.filter((r) => r.stale || paused[r.symbol]) : rows;
  const staleCount = rows.filter((r) => r.stale).length;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Feed status"
        subtitle={`Infoways primary + backup · stale threshold 3,000ms · ${staleCount} stale`}
        icon={<Activity />}
        action={<Segmented size="xs" value={filter} onChange={setFilter} options={[{ value: "all", label: `All ${rows.length}` }, { value: "stale", label: `Stale ${staleCount}` }]} />}
      />
      <div className="mt-4 grid grid-cols-1 gap-1.5 px-4 pb-5 sm:grid-cols-2 sm:px-6 2xl:grid-cols-3">
        {list.map((r) => {
          const isPaused = paused[r.symbol];
          const tone = r.stale ? "text-down" : r.age > 1000 ? "text-warn" : "text-up";
          return (
            <div key={r.symbol} className={cn("k-row flex items-center gap-3 px-3 py-2", r.stale && "border-down/40 bg-down-soft shadow-[0_0_24px_-12px_var(--k-down)]")}>
              <SymbolAvatar symbol={r.symbol} size={22} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  {r.symbol}
                  {isPaused && (
                    <Chip size="sm" tone="down">
                      Close-only
                    </Chip>
                  )}
                </div>
                <div className="truncate text-[10.5px] text-fg-3">
                  {r.provider} · {r.ticksPerMin}/min
                </div>
              </div>
              <div className="text-right">
                <div className={cn("k-num font-mono text-[12.5px] font-semibold", tone)}>{r.age >= 1000 ? `${(r.age / 1000).toFixed(1)}s` : `${Math.round(r.age)}ms`}</div>
                <div className="text-[10px] text-fg-3">last tick</div>
              </div>
              {isPaused ? (
                <Tooltip content="Resume trading">
                  <button onClick={() => setTarget(r.symbol)} className="grid size-7 place-items-center rounded-full border border-up/30 bg-up-soft text-up hover:bg-up/20" aria-label="Resume">
                    <PlayCircle className="size-3.5" />
                  </button>
                </Tooltip>
              ) : (
                <Tooltip content="Pause (close-only)">
                  <button onClick={() => setTarget(r.symbol)} className="grid size-7 place-items-center rounded-full border border-line text-fg-3 hover:text-fg" aria-label="Pause">
                    <PauseCircle className="size-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
      {target && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={paused[target] ? `Resume trading on ${target}` : `Pause ${target} (close-only)`}
          description={paused[target] ? "Feed must be fresh for 30s before resuming. Pending orders will be re-armed." : "New orders are rejected; clients can still close positions."}
          codes={["FEED-01 · Stale / gap in feed", "FEED-02 · Feed recovered", "FEED-03 · Abnormal spread", "FEED-04 · Market holiday / session"]}
          confirmLabel={paused[target] ? "Resume trading" : "Pause symbol"}
          confirmVariant={paused[target] ? "buy" : "sell"}
          successMessage={paused[target] ? `${target} trading resumed` : `${target} set to close-only`}
          onConfirm={() => setPaused((p) => ({ ...p, [target]: !p[target] }))}
        />
      )}
    </Card>
  );
}

export default function SystemPage() {
  const tick = useTick(2000);
  const degraded = SERVICES.filter((s) => s.status !== "healthy");
  const [kind, setKind] = React.useState<"all" | "service" | "datastore">("all");
  const services = SERVICES.filter((s) => kind === "all" || s.kind === kind);
  const errData = ERROR_RATE.map((e) => ({ t: e.t, v: e.rate5xx, vol: Math.round(e.rate4xx * 100) }));
  const lastErr = ERROR_RATE[ERROR_RATE.length - 1]!;
  return (
    <div className="pb-10">
      <PageHeader
        title="System"
        subtitle="Service health, market-data feeds, message queues and error rates across the platform."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => toast("Opening Grafana…", { description: "grafana.ezymex.internal/d/platform" })}>
              <ExternalLink /> Grafana
            </Button>
            <Button variant="ember" size="lg" onClick={() => toast.success("Diagnostics started", { description: "Health probes on 14 services · ~20s" })}>
              <RefreshCw /> Run diagnostics
            </Button>
          </>
        }
      />

      <Reveal>
        <Card className={cn("mb-4 flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center", degraded.length ? "border-warn/30" : "")}>
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-full border", degraded.length ? "border-warn/30 bg-warn-soft text-warn" : "border-up/30 bg-up-soft text-up")}>
            {degraded.length ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-medium">{degraded.length ? `${degraded.length} service degraded · 1 feed stale` : "All systems operational"}</div>
            <div className="text-[12.5px] text-fg-3">
              {degraded.map((d) => d.name).join(", ")} above SLO · USOIL auto-paused (close-only) · no client-facing downtime in 30 days
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right">
            {[
              ["Uptime 30d", "99.991%"],
              ["5xx rate", `${lastErr.rate5xx.toFixed(2)}%`],
              ["WS sessions", formatNumber(8412 + (tick % 7) * 13, 0)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                <div className="k-num font-mono text-[15px] font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-medium tracking-tight">
            <Cpu className="size-4 text-fg-3" /> Service health
          </h2>
          <Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "all", label: "All 14" }, { value: "service", label: "Services" }, { value: "datastore", label: "Datastores" }]} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
          {services.map((s) => (
            <ServiceCard key={s.name} s={s} tick={tick} />
          ))}
        </div>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <FeedStatus />
        </Reveal>
        <Reveal delay={0.15} className="flex flex-col gap-4 xl:col-span-5">
          <Card>
            <CardHeader title="Error rate" subtitle="5xx % of gateway requests · last 6h · bars = 4xx" action={<Chip tone={lastErr.rate5xx > 0.1 ? "warn" : "up"} dot>{lastErr.rate5xx.toFixed(2)}% now</Chip>} />
            <div className="px-4 pb-4 pt-3 sm:px-6">
              <IntradayChart data={errData} height={200} tone="ember" format={(v) => `${v.toFixed(3)}%`} xTicks={5} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Queue depths" subtitle="NATS JetStream consumers" />
            <div className="space-y-3 px-6 pb-5 pt-4">
              {QUEUE_DEPTHS.map((q) => {
                const d = Math.max(0, Math.round(q.depth * jitter(q.name, tick)));
                const pct = (d / q.max) * 100;
                return (
                  <div key={q.name} className="flex items-center gap-3 text-[12.5px]">
                    <span className="w-40 truncate font-mono text-fg-2">{q.name}</span>
                    <Progress value={Math.max(pct, 1.5)} tone={pct > 50 ? "warn" : "up"} className="flex-1" />
                    <span className="k-num w-14 text-right font-mono">{formatNumber(d, 0)}</span>
                    <span className="w-10 text-right text-[11px] text-fg-3">×{q.consumers}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Incidents" subtitle="Auto-opened from alert rules · status page synced" icon={<Siren />} />
          <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
            {INCIDENTS.map((i) => (
              <div key={i.id} className="k-row flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-mono text-[12px] text-fg-3">{i.id}</span>
                <SeverityChip severity={i.severity} />
                <span className="flex-1 text-[13.5px] font-medium">{i.title}</span>
                <span className="font-mono text-[11.5px] text-fg-3">
                  {serverTime(i.started)} · {timeAgo(i.started)}
                </span>
                <Chip size="sm" tone={i.status === "resolved" ? "up" : i.status === "monitoring" ? "info" : "warn"} dot className="capitalize">
                  {i.status}
                </Chip>
                <Button size="xs" variant="surface" onClick={() => toast(`${i.id} timeline`, { description: `${i.title} · 4 updates · on-call: Dev Patel` })}>
                  Timeline
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
