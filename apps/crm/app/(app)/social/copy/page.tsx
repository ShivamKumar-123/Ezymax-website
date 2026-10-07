"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Ban, Layers, Repeat, Search, ShieldCheck, Sliders } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, Icon3D, Money, PageHeader, Reveal, Segmented, Sparkline, StatusChip, cn, formatCompact } from "@/components/kit";
import { MASTERS, MY_COPY_SUBS, masterById, masterSpark, type Master } from "@kalks/mock/social";
import { MasterIdentity, RiskBadge, formatAge } from "@/components/social/master-bits";
import { CopyDialog } from "@/components/social/copy-dialog";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveCopyPage } from "@/components/social-live/subscriptions";

type RiskF = "all" | "low" | "med" | "high";
type SortF = "return" | "dd" | "followers" | "fee";

const STEPS = [
  { icon: "magnifying_glass_tilted_left", t: "Pick a master", s: "Verified track record, risk score and fees up front" },
  { icon: "gear", t: "Choose sizing", s: "Proportional, fixed lot, multiplier or fixed allocation" },
  { icon: "shield", t: "Set risk controls", s: "Equity stop, max lot and excluded symbols" },
  { icon: "rocket", t: "Copy account opens", s: "A dedicated #81… account mirrors every trade" },
];

function MasterRow({ m, onCopy }: { m: Master; onCopy: () => void }) {
  const spark = React.useMemo(() => masterSpark(m, 40), [m]);
  const copying = MY_COPY_SUBS.find((s) => s.masterId === m.id);
  return (
    <div className="k-row px-4 py-4 transition-colors hover:border-[var(--k-border-top)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={`/social/masters/${m.id}`} className="min-w-0 flex-1">
          <MasterIdentity m={m} size={44} />
        </Link>
        <div className="flex items-center gap-2">
          <RiskBadge risk={m.risk} />
          {copying ? (
            <Link href="/social/investments">
              <Button size="sm" variant="up-outline">
                Copying
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="ember" onClick={onCopy}>
              <Repeat /> Start copying
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 items-end gap-3 border-t border-line pt-3 sm:grid-cols-6">
        {[
          ["Return 1Y", <span key="r" className={cn("text-[15px] font-semibold", m.return1y >= 0 ? "text-up" : "text-down")}>+{m.return1y.toFixed(1)}%</span>],
          ["Max DD", <span key="d" className="text-down">-{m.maxDD.toFixed(1)}%</span>],
          ["Copiers", formatCompact(m.followers)],
          ["Perf. fee", `${m.perfFee}% HWM`],
          ["Min · track", `$${m.minInvestment} · ${formatAge(m.ageDays)}`],
        ].map(([k, v], i) => (
          <div key={i} className={cn("min-w-0", i > 2 && "hidden sm:block")}>
            <div className="text-[11px] text-fg-3">{k}</div>
            <div className="k-num truncate text-[13.5px] font-medium">{v}</div>
          </div>
        ))}
        <Sparkline data={spark} width={110} height={30} className="ml-auto hidden sm:block" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {m.tags.map((t) => (
          <span key={t} className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] text-fg-2">
            {t}
          </span>
        ))}
        {m.api && <span className="rounded-md bg-ember-soft px-1.5 py-0.5 text-[10.5px] text-ember">API</span>}
      </div>
    </div>
  );
}

function DemoCopyTradingPage() {
  const [q, setQ] = React.useState("");
  const [risk, setRisk] = React.useState<RiskF>("all");
  const [sort, setSort] = React.useState<SortF>("return");
  const [sel, setSel] = React.useState<Master | null>(null);

  const list = React.useMemo(() => {
    const f = MASTERS.filter(
      (m) =>
        m.program !== "pamm" &&
        (risk === "all" || (risk === "low" ? m.risk <= 3 : risk === "med" ? m.risk >= 4 && m.risk <= 6 : m.risk >= 7)) &&
        `${m.person.name} ${m.strategy} ${m.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
    );
    const k = (m: Master) => (sort === "return" ? -m.return1y : sort === "dd" ? m.maxDD : sort === "followers" ? -m.followers : m.perfFee);
    return [...f].sort((a, b) => k(a) - k(b));
  }, [q, risk, sort]);

  const active = MY_COPY_SUBS.filter((s) => s.status !== "stopped");
  const allocated = active.reduce((s, x) => s + x.allocated, 0);
  const equity = active.reduce((s, x) => s + x.equity, 0);
  const pnl = equity - allocated;

  return (
    <div className="pb-24">
      <PageHeader
        title="Copy trading"
        subtitle="Mirror a master's trades automatically in your own dedicated copy account."
        actions={
          <Link href="/social/investments">
            <Button variant="surface" size="lg">
              My copy portfolio <ArrowUpRight />
            </Button>
          </Link>
        }
      />

      <Reveal>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.t} className="k-card relative flex items-center gap-4 overflow-hidden px-5 py-4">
              <Icon3D name={s.icon} size={44} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[14px] font-medium">
                  <span className="grid size-5 place-items-center rounded-full bg-ember-soft font-mono text-[10.5px] text-ember">{i + 1}</span>
                  {s.t}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-fg-3">{s.s}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.06} className="xl:col-span-8">
          <Card>
            <CardHeader title="Copy masters" subtitle={`${list.length} strategies open for copying`} icon={<Repeat />} />
            <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:max-w-xs">
                <Search className="size-3.5 text-fg-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search masters, markets…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
              </div>
              <Segmented
                size="xs"
                value={risk}
                onChange={setRisk}
                options={[
                  { value: "all", label: "Any risk" },
                  { value: "low", label: "Low" },
                  { value: "med", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
              <Segmented
                size="xs"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "return", label: "Return" },
                  { value: "dd", label: "Drawdown" },
                  { value: "followers", label: "Copiers" },
                  { value: "fee", label: "Fee" },
                ]}
              />
            </div>
            <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
              {list.map((m) => (
                <MasterRow key={m.id} m={m} onCopy={() => setSel(m)} />
              ))}
              {list.length === 0 && <div className="k-row px-4 py-10 text-center text-[13px] text-fg-3">No masters match these filters.</div>}
            </div>
          </Card>
        </Reveal>

        <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:col-span-4 xl:self-start">
          <Reveal delay={0.1}>
            <Card hot className="overflow-hidden">
              <div className="relative p-6">
                <div className="k-label text-ember">Your copy portfolio</div>
                <Money value={equity} className="mt-2 block text-[32px] font-semibold tracking-tight" />
                <div className="mt-1 flex items-center gap-2 text-[12.5px]">
                  <span className="text-fg-2">Allocated {`$${allocated.toLocaleString()}`}</span>
                  <Chip size="sm" tone={pnl >= 0 ? "up" : "down"}>
                    {pnl >= 0 ? "+" : ""}
                    {((pnl / allocated) * 100).toFixed(2)}%
                  </Chip>
                </div>
                <div className="mt-5 space-y-2">
                  {MY_COPY_SUBS.map((s) => {
                    const m = masterById(s.masterId)!;
                    return (
                      <Link key={s.id} href="/social/investments" className="flex items-center gap-3 rounded-[14px] border border-white/10 light:border-line bg-black/25 light:bg-white/70 px-3.5 py-2.5 transition-colors hover:bg-black/40 light:hover:bg-white">
                        <Avatar src={m.person.photo} name={m.person.name} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{m.person.name}</div>
                          <div className="font-mono text-[11px] text-fg-3">#{s.copyAccount}</div>
                        </div>
                        <div className="text-right">
                          <div className={cn("k-num text-[13px] font-medium", s.pnl >= 0 ? "text-up" : "text-down")}>
                            {s.pnl >= 0 ? "+" : "-"}${Math.abs(s.pnl).toFixed(2)}
                          </div>
                          <StatusChip status={s.status} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.14}>
            <Card>
              <CardHeader title="How copying works" subtitle="Rules that protect you" icon={<ShieldCheck />} />
              <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
                {[
                  { icon: <Layers />, t: "Everything is mirrored", s: "Opens, partial closes, SL/TP changes and pending orders." },
                  { icon: <Ban />, t: "No single-trade closing", s: "Copied trades can't be closed one by one — pause or stop copying instead." },
                  { icon: <Sliders />, t: "Your limits win", s: "Equity stop, max lot and excluded symbols override the master." },
                  { icon: <ShieldCheck />, t: "Fees above high-water mark", s: "Performance fees accrue as pending and are released after admin approval." },
                ].map((r) => (
                  <div key={r.t} className="k-row flex items-start gap-3 px-3.5 py-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{r.icon}</span>
                    <div>
                      <div className="text-[13px] font-medium">{r.t}</div>
                      <div className="text-[12px] leading-snug text-fg-3">{r.s}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <CopyDialog master={sel} open={!!sel} onOpenChange={(o) => !o && setSel(null)} />
    </div>
  );
}

export default function CopyTradingPage() {
  return DEMO_BUILD ? <DemoCopyTradingPage /> : <LiveCopyPage />;
}
