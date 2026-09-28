"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { BellPlus, CalendarDays, ChevronDown, Clock3, Flame, Info } from "lucide-react";
import { Button, Card, Chip, Delta, Icon3D, PageHeader, PriceText, Reveal, SymbolAvatar, cn, useQuotes } from "@kalks/ui";
import { POSITIONS } from "@kalks/mock";
import { CAL_COUNTRIES, TODAY_INDEX, WEEK_DAYS, WEEK_EVENTS, surprise, type WeekEvent } from "@kalks/mock/calendar-extra";
import { ColumnBars } from "@/components/portfolio/charts";

const NOW_HHMM = "18:40"; // server time GMT+3 (mock clock)

function ImpactBars({ impact, className }: { impact: 1 | 2 | 3; className?: string }) {
  const color = impact === 3 ? "bg-down" : impact === 2 ? "bg-warn" : "bg-fg-2";
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} aria-label={`Impact ${impact} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("w-[4px] rounded-full", i <= impact ? color : "bg-surface-3")} style={{ height: 6 + i * 3 }} />
      ))}
    </span>
  );
}

function ActualCell({ e }: { e: WeekEvent }) {
  if (!e.actual) return <span className="text-fg-3">—</span>;
  const s = surprise(e);
  return <span className={cn("font-semibold", s === 1 ? "text-up" : s === -1 ? "text-down" : "text-fg")}>{e.actual}</span>;
}

function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = React.useState(seconds);
  React.useEffect(() => {
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(Math.floor(left / 3600)).padStart(2, "0");
  const mm = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return <span className="k-num rounded-lg border border-line bg-surface/60 px-2 py-0.5 font-mono text-fg">{hh}:{mm}:{ss}</span>;
}

/* ------------------------------------------------------------------ */

function Detail({ e }: { e: WeekEvent }) {
  const syms = e.symbols;
  const qs = useQuotes(syms);
  const held = POSITIONS.filter((p) => syms.includes(p.symbol));
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
      <div className="grid grid-cols-1 gap-4 border-b border-line bg-surface-2/50 px-5 py-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="k-label mb-2">Release history</div>
          {e.history.length ? (
            <ColumnBars
              data={e.history.map((v, i) => ({ label: i === e.history.length - 1 ? "Last" : `-${e.history.length - 1 - i}`, value: v }))}
              height={150}
              tone="gold"
              fit
              format={(v) => `${v}${e.unit}`}
            />
          ) : (
            <div className="k-row grid h-[150px] place-items-center text-[12.5px] text-fg-3">Speeches and minutes have no numeric history</div>
          )}
        </div>
        <div className="lg:col-span-4">
          <div className="k-label mb-2">About this event</div>
          <p className="text-[13px] leading-relaxed text-fg-2">{e.about}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["Actual", e.actual ?? "Pending"],
              ["Forecast", e.forecast],
              ["Previous", e.previous],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-surface px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-fg-3">{k}</div>
                <div className="k-num mt-0.5 text-[13.5px] font-medium">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="surface" onClick={() => toast.success("Reminder set", { description: `${e.title} · 15 minutes before ${e.time} GMT+3` })}>
              <BellPlus /> Remind me
            </Button>
            <Link href="/academy/coach">
              <Button size="sm" variant="ghost">
                Ask AI how to trade it
              </Button>
            </Link>
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="k-label mb-2">Affected symbols</div>
          <div className="space-y-1.5">
            {syms.map((s) => (
              <Link key={s} target="_blank" rel="noopener" href={`/trade?symbol=${s}`} className="k-row flex items-center gap-2.5 bg-surface px-3 py-2 transition-colors hover:border-ember/40">
                <SymbolAvatar symbol={s} size={20} />
                <span className="flex-1 text-[12.5px] font-medium">{s}</span>
                <PriceText symbol={s} value={qs[s]!.bid} dir={qs[s]!.dir} className="text-[12px]" />
                <Delta value={qs[s]!.change} className="w-14 justify-end text-[11px]" />
              </Link>
            ))}
          </div>
          {held.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-[11.5px] text-warn">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              You hold {held.map((p) => `${p.side} ${p.volume} ${p.symbol}`).join(", ")}.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

export default function CalendarPage() {
  const [day, setDay] = React.useState(TODAY_INDEX);
  const [impacts, setImpacts] = React.useState<number[]>([1, 2, 3]);
  const [countries, setCountries] = React.useState<string[]>([]);
  const [openId, setOpenId] = React.useState<string | null>("we23");

  const events = WEEK_EVENTS.filter((e) => e.day === day && impacts.includes(e.impact) && (!countries.length || countries.includes(e.country))).sort((a, b) => a.time.localeCompare(b.time));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const nextHigh = WEEK_EVENTS.find((e) => (e.day > TODAY_INDEX || (e.day === TODAY_INDEX && e.time > NOW_HHMM)) && e.impact === 3)!;
  const highCount = WEEK_EVENTS.filter((e) => e.impact === 3).length;
  const nowIdx = day === TODAY_INDEX ? events.findIndex((e) => e.time > NOW_HHMM) : -1;

  return (
    <div className="pb-24">
      <PageHeader
        title="Economic calendar"
        subtitle="Week of 21–25 September 2026 · all times in server time GMT+3"
        actions={
          <Button variant="surface" onClick={() => toast.success("Calendar subscribed", { description: "High-impact events will appear in your Google Calendar" })}>
            <CalendarDays /> Subscribe (.ics)
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Reveal>
          <Card hot className="relative h-full overflow-hidden px-6 py-5">
            <div className="k-label">Next high-impact</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`fi fis fi-${nextHigh.country} size-5 rounded-full`} />
              <span className="text-[17px] font-medium">{nextHigh.title}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12.5px] text-fg-2">
              <Clock3 className="size-3.5 text-ember" /> {WEEK_DAYS[nextHigh.day]!.label} {nextHigh.time} ·
              <Countdown seconds={(() => {
                const [h, m] = nextHigh.time.split(":").map(Number) as [number, number];
                const [nh, nm] = NOW_HHMM.split(":").map(Number) as [number, number];
                return (nextHigh.day - TODAY_INDEX) * 86400 + (h * 60 + m - nh * 60 - nm) * 60;
              })()} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05}>
          <Card className="h-full px-6 py-5">
            <div className="k-label">This week</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="k-num text-[30px] font-semibold">{WEEK_EVENTS.length}</span>
              <span className="text-[13px] text-fg-3">events</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Chip tone="down">
                <Flame className="size-3" /> {highCount} high
              </Chip>
              <Chip tone="warn">{WEEK_EVENTS.filter((e) => e.impact === 2).length} medium</Chip>
              <Chip>{WEEK_EVENTS.filter((e) => e.impact === 1).length} low</Chip>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="h-full px-6 py-5">
            <div className="k-label">Affects your positions</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from(new Set(POSITIONS.map((p) => p.symbol))).map((s) => (
                <Link key={s} target="_blank" rel="noopener" href={`/trade?symbol=${s}`} className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2.5 text-[12px] font-medium hover:border-ember/40">
                  <SymbolAvatar symbol={s} size={18} />
                  {s}
                  <span className="k-num text-fg-3">{WEEK_EVENTS.filter((e) => e.symbols.includes(s)).length}</span>
                </Link>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card className="overflow-hidden">
          {/* Day tabs */}
          <div className="flex gap-2 overflow-x-auto border-b border-line px-4 pt-4 sm:px-6">
            {WEEK_DAYS.map((d) => {
              const on = d.day === day;
              const evs = WEEK_EVENTS.filter((e) => e.day === d.day);
              return (
                <button key={d.day} onClick={() => setDay(d.day)} className={cn("relative min-w-[96px] flex-1 rounded-t-2xl px-4 pb-3 pt-2.5 text-left transition-colors", on ? "bg-surface-2" : "hover:bg-surface-2/50")}>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[13.5px] font-medium", on ? "text-fg" : "text-fg-2")}>{d.label}</span>
                    {d.day === TODAY_INDEX && (
                      <Chip size="sm" tone="ember">
                        Today
                      </Chip>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11.5px] text-fg-3">
                    <span>{d.date}</span>
                    <span className="flex items-center gap-1">
                      {evs.filter((e) => e.impact === 3).map((e) => (
                        <span key={e.id} className="size-1.5 rounded-full bg-down" />
                      ))}
                      <span className="k-num ml-1">{evs.length}</span>
                    </span>
                  </div>
                  {on && <motion.span layoutId="cal-day" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ember" />}
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-[12px] text-fg-3">Impact</span>
              {([3, 2, 1] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setImpacts((x) => (x.includes(i) && x.length === 1 ? x : toggle(x, i)))}
                  className={cn("flex h-8 items-center gap-2 rounded-full border px-3 text-[12px] transition-colors", impacts.includes(i) ? "border-line bg-surface-3 text-fg" : "border-line bg-transparent text-fg-3 opacity-60")}
                >
                  <ImpactBars impact={i} />
                  {i === 3 ? "High" : i === 2 ? "Medium" : "Low"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] text-fg-3">Country</span>
              {CAL_COUNTRIES.map((c) => {
                const on = countries.includes(c.code);
                return (
                  <button
                    key={c.code}
                    title={`${c.name} (${c.currency})`}
                    onClick={() => setCountries((x) => toggle(x, c.code))}
                    className={cn("flex h-8 items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium transition-all", on ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-3 hover:text-fg-2", countries.length && !on && "opacity-50")}
                  >
                    <span className={`fi fis fi-${c.code} size-4 rounded-full`} />
                    <span className="hidden sm:inline">{c.currency}</span>
                  </button>
                );
              })}
              {countries.length > 0 && (
                <button onClick={() => setCountries([])} className="px-2 text-[12px] text-fg-3 hover:text-fg">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="mx-4 grid grid-cols-[72px_110px_1fr_70px_90px_90px_90px_32px] items-center rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3 sm:mx-6">
                <span>Time</span>
                <span>Currency</span>
                <span>Event</span>
                <span>Impact</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Forecast</span>
                <span className="text-right">Previous</span>
                <span />
              </div>
              <div className="px-4 pb-4 sm:px-6">
                {events.length === 0 && <div className="py-12 text-center text-[13px] text-fg-3">No events match these filters.</div>}
                {events.map((e, i) => {
                  const open = openId === e.id;
                  return (
                    <React.Fragment key={e.id}>
                      {i === nowIdx && (
                        <div className="relative my-1 flex items-center gap-2 py-1">
                          <span className="k-num rounded-full bg-ember px-2 py-0.5 font-mono text-[10.5px] font-semibold text-white">{NOW_HHMM}</span>
                          <span className="h-px flex-1 bg-gradient-to-r from-ember to-transparent" />
                          <span className="text-[11px] text-ember">Now</span>
                        </div>
                      )}
                      <button
                        onClick={() => setOpenId(open ? null : e.id)}
                        className={cn(
                          "relative grid w-full grid-cols-[72px_110px_1fr_70px_90px_90px_90px_32px] items-center border-b border-line px-4 py-3 text-left text-[13.5px] transition-colors hover:bg-surface-2/60",
                          open && "bg-surface-2/60",
                          day === TODAY_INDEX && e.time < NOW_HHMM && !open && "opacity-80",
                        )}
                      >
                        <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", e.impact === 3 ? "bg-down" : e.impact === 2 ? "bg-warn" : "bg-fg-3/40")} />
                        <span className="k-num font-mono text-[12.5px] text-fg-2">{e.time}</span>
                        <span className="flex items-center gap-2">
                          <span className={`fi fis fi-${e.country} size-5 rounded-full ring-1 ring-black/20`} />
                          <span className="font-mono text-[12.5px] font-medium">{e.currency}</span>
                        </span>
                        <span className="truncate pr-3 font-medium">{e.title}</span>
                        <ImpactBars impact={e.impact} />
                        <span className="k-num text-right">
                          <ActualCell e={e} />
                        </span>
                        <span className="k-num text-right text-fg-2">{e.forecast}</span>
                        <span className="k-num text-right text-fg-3">{e.previous}</span>
                        <ChevronDown className={cn("ml-auto size-4 text-fg-3 transition-transform", open && "rotate-180 text-fg")} />
                      </button>
                      <AnimatePresence initial={false}>{open && <Detail e={e} />}</AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-line px-6 py-3 text-[11.5px] text-fg-3">
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-up">Green</span> actual beat forecast for the currency
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-down">Red</span> missed forecast
            </span>
            <span>Click any row for history and affected symbols</span>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
