"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, Flag, IconButton, PageHeader, Reveal, Segmented, SymbolAvatar, Tooltip, cn } from "@kalks/ui";
import { INSTRUMENTS } from "@kalks/mock";
import { HOLIDAYS, SESSIONS, SYMBOL_SPECS, WEEKDAYS, type Holiday, type SessionTemplate } from "@kalks/mock/admin-config";
import { MiniField, Select, TextInput, auditToast } from "@/components/config/kit";

const fmtH = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

function useServerNow() {
  const [now, setNow] = React.useState<{ day: number; hour: number } | null>(null);
  React.useEffect(() => {
    const tick = () => {
      const d = new Date(Date.now() + 3 * 3600_000);
      setNow({ day: (d.getUTCDay() + 6) % 7, hour: d.getUTCHours() + d.getUTCMinutes() / 60 });
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function DayBar({ trade, quote, nowHour }: { trade: [number, number][]; quote?: [number, number][]; nowHour?: number }) {
  return (
    <div className="relative h-6 overflow-hidden rounded-[7px] bg-surface-2 ring-1 ring-line">
      {[6, 12, 18].map((h) => (
        <span key={h} className="absolute inset-y-0 w-px bg-line" style={{ left: `${(h / 24) * 100}%` }} />
      ))}
      {quote?.map(([a, b], i) => (
        <span key={`q${i}`} className="absolute inset-y-1 rounded-[4px] bg-[repeating-linear-gradient(135deg,var(--k-gold-soft)_0_3px,transparent_3px_6px)] ring-1 ring-gold/30" style={{ left: `${(a / 24) * 100}%`, width: `${((b - a) / 24) * 100}%` }} />
      ))}
      {trade.map(([a, b], i) => (
        <Tooltip key={i} content={`Trade ${fmtH(a)}–${fmtH(b)}`}>
          <span className="absolute inset-y-1 rounded-[4px] bg-gradient-to-r from-ember/70 to-ember shadow-[0_0_10px_-2px_rgba(255,90,31,0.6)]" style={{ left: `${(a / 24) * 100}%`, width: `${((b - a) / 24) * 100}%` }} />
        </Tooltip>
      ))}
      {nowHour !== undefined && <span className="absolute inset-y-0 z-10 w-0.5 bg-fg shadow-[0_0_6px_rgba(255,255,255,0.8)]" style={{ left: `${(nowHour / 24) * 100}%` }} />}
    </div>
  );
}

function isOpen(t: SessionTemplate, day: number, hour: number) {
  return (t.trade[day] ?? []).some(([a, b]) => hour >= a && hour < b);
}

function SessionGrid() {
  const now = useServerNow();
  const [view, setView] = React.useState<"template" | "symbol">("template");
  const rows: { key: string; label: React.ReactNode; sub: string; t: SessionTemplate }[] =
    view === "template"
      ? SESSIONS.map((t) => ({ key: t.key, label: t.name, sub: `${t.exchange} · ${SYMBOL_SPECS.filter((s) => s.session === t.key).length} symbols`, t }))
      : SYMBOL_SPECS.map((s) => {
          const t = SESSIONS.find((x) => x.key === s.session)!;
          return {
            key: s.symbol,
            label: (
              <span className="flex items-center gap-2">
                <SymbolAvatar symbol={s.symbol} size={18} /> {s.symbol}
              </span>
            ),
            sub: t.name,
            t,
          };
        });
  return (
    <Card>
      <CardHeader
        title="Trading sessions"
        subtitle="Weekly 24h grid · server time GMT+3 · hover a bar for exact times"
        action={
          <div className="flex items-center gap-2">
            {now && (
              <Chip tone="ember" dot>
                Now {WEEKDAYS[now.day]} {fmtH(now.hour)}
              </Chip>
            )}
            <Segmented size="xs" value={view} onChange={setView} options={[{ value: "template", label: "By template" }, { value: "symbol", label: "By symbol" }]} />
          </div>
        }
      />
      <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
        <div className="min-w-[1040px]">
          <div className="grid grid-cols-[200px_repeat(7,minmax(0,1fr))_70px] items-center gap-2 border-b border-line pb-2 text-[11px] uppercase tracking-wider text-fg-3">
            <span>{view === "template" ? "Session" : "Symbol"}</span>
            {WEEKDAYS.map((d, i) => (
              <span key={d} className={cn(now?.day === i && "text-ember")}>
                {d}
              </span>
            ))}
            <span className="text-right">Status</span>
          </div>
          <div className={cn("divide-y divide-line", view === "symbol" && "max-h-[560px] overflow-y-auto pr-1")}>
            {rows.map((r) => {
              const open = now ? isOpen(r.t, now.day, now.hour) : false;
              return (
                <div key={r.key} className="grid grid-cols-[200px_repeat(7,minmax(0,1fr))_70px] items-center gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{r.label}</div>
                    <div className="truncate text-[11px] text-fg-3">{r.sub}</div>
                  </div>
                  {WEEKDAYS.map((_, di) => (
                    <DayBar key={di} trade={r.t.trade[di] ?? []} quote={r.t.quoteOnly?.[di]} nowHour={now?.day === di ? now.hour : undefined} />
                  ))}
                  <div className="text-right">
                    <Chip size="sm" tone={open ? "up" : "neutral"} dot>
                      {open ? "Open" : "Closed"}
                    </Chip>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11.5px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-[3px] bg-ember" /> Trading
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-[3px] bg-[repeating-linear-gradient(135deg,var(--k-gold-soft)_0_3px,transparent_3px_6px)] ring-1 ring-gold/40" /> Quotes only (no trading)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-fg" /> Server time now
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

const MONTHS = [
  { y: 2026, m: 8, label: "September 2026" },
  { y: 2026, m: 9, label: "October 2026" },
  { y: 2026, m: 10, label: "November 2026" },
  { y: 2026, m: 11, label: "December 2026" },
];

const EFFECT_TONE: Record<Holiday["effect"], "down" | "warn" | "info"> = { closed: "down", "early-close": "warn", "late-open": "info" };
const EFFECT_LABEL: Record<Holiday["effect"], string> = { closed: "Closed", "early-close": "Early close", "late-open": "Late open" };

function HolidayCalendar({ holidays, onAdd }: { holidays: Holiday[]; onAdd: () => void }) {
  const [mi, setMi] = React.useState(0);
  const { y, m, label } = MONTHS[mi]!;
  const first = new Date(Date.UTC(y, m, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1);
  const key = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const [sel, setSel] = React.useState<string | null>("2026-09-23");
  const list = holidays.filter((h) => h.date.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`));
  return (
    <Card className="h-full">
      <CardHeader
        title="Holiday calendar"
        subtitle="Exchange holidays and early closes applied to sessions"
        action={
          <div className="flex items-center gap-1.5">
            <IconButton size="sm" disabled={mi === 0} onClick={() => setMi((v) => v - 1)} aria-label="Previous month">
              <ChevronLeft />
            </IconButton>
            <span className="w-32 text-center text-[13px] font-medium">{label}</span>
            <IconButton size="sm" disabled={mi === MONTHS.length - 1} onClick={() => setMi((v) => v + 1)} aria-label="Next month">
              <ChevronRight />
            </IconButton>
            <Button size="sm" variant="surface" onClick={onAdd}>
              <Plus /> Add
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-5 px-4 pb-6 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-[11px] uppercase tracking-wider text-fg-3">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              const valid = d >= 1 && d <= days;
              const hs = valid ? holidays.filter((h) => h.date === key(d)) : [];
              const weekend = i % 7 >= 5;
              const today = key(d) === "2026-09-24";
              return (
                <button
                  key={i}
                  disabled={!valid}
                  onClick={() => setSel(key(d))}
                  className={cn(
                    "relative flex min-h-[74px] flex-col items-start gap-1 rounded-[12px] border p-1.5 text-left transition-colors",
                    !valid && "border-transparent",
                    valid && "border-line bg-surface-2 hover:border-[var(--k-border-top)]",
                    valid && weekend && "bg-surface-2/40",
                    hs.length > 0 && "border-ember/25",
                    sel === key(d) && valid && "border-ember/60 ring-2 ring-ember/15",
                  )}
                >
                  {valid && (
                    <>
                      <span className={cn("k-num text-[12px]", weekend ? "text-fg-3" : "text-fg-2", today && "grid size-5 place-items-center rounded-full bg-ember font-semibold text-white")}>{d}</span>
                      {hs.slice(0, 2).map((h) => (
                        <span key={h.name + h.exchange} className={cn("flex w-full items-center gap-1 truncate rounded-md px-1 py-0.5 text-[10px] font-medium", h.effect === "closed" ? "bg-down-soft text-down" : h.effect === "early-close" ? "bg-warn-soft text-warn" : "bg-info-soft text-info")}>
                          <Flag country={h.country} className="size-2.5" />
                          <span className="truncate">{h.name}</span>
                        </span>
                      ))}
                      {hs.length > 2 && <span className="text-[10px] text-fg-3">+{hs.length - 2} more</span>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <div className="k-label mb-1">{list.length} holiday{list.length === 1 ? "" : "s"} this month</div>
          {list.length === 0 && <div className="k-row px-4 py-6 text-center text-[12.5px] text-fg-3">No exchange holidays. Regular sessions apply.</div>}
          {list.map((h) => (
            <div key={h.date + h.name + h.exchange} className={cn("k-row px-3.5 py-2.5 transition-colors", sel === h.date && "border-ember/40")}>
              <div className="flex items-center gap-2">
                <Flag country={h.country} className="size-4" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{h.name}</span>
                <Chip size="sm" tone={EFFECT_TONE[h.effect]}>
                  {EFFECT_LABEL[h.effect]}
                  {h.time ? ` ${h.time}` : ""}
                </Chip>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-fg-3">
                <span className="min-w-0 truncate">{h.exchange} · {h.symbols}</span>
                <span className="shrink-0 whitespace-nowrap font-mono">
                  {new Date(h.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function SessionsPage() {
  const [holidays, setHolidays] = React.useState<Holiday[]>(HOLIDAYS);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Holiday>({ date: "2026-10-26", name: "", exchange: "NYSE / CME", country: "us", effect: "closed", symbols: "US stocks" });

  return (
    <div className="pb-16">
      <PageHeader
        title="Sessions & holidays"
        subtitle="When each instrument quotes and trades, plus exchange holidays and early closes."
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Holiday feed imported", { description: "Source: LP calendar · 4 new entries for Q1 2027 staged for review" })}>
              <Upload /> Import LP calendar
            </Button>
            <Button variant="ember" onClick={() => setOpen(true)}>
              <Plus /> Add holiday
            </Button>
          </>
        }
      />
      <Reveal>
        <SessionGrid />
      </Reveal>
      <Reveal delay={0.05} className="mt-4 block">
        <HolidayCalendar holidays={holidays} onAdd={() => setOpen(true)} />
      </Reveal>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add exchange holiday"
        description="Sessions for the affected symbols are overridden on this date. Clients get a terminal notice 48h before."
        width={520}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="ember"
              disabled={!draft.name}
              onClick={() => {
                setHolidays((p) => [...p, draft].sort((a, b) => a.date.localeCompare(b.date)));
                auditToast(`Holiday “${draft.name}” added`, `${draft.date} · ${draft.exchange}`);
                setOpen(false);
              }}
            >
              Add holiday
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Name" className="col-span-2">
            <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="e.g. Diwali (Muhurat trading)" />
          </MiniField>
          <MiniField label="Date">
            <TextInput value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} mono />
          </MiniField>
          <MiniField label="Exchange">
            <Select value={draft.exchange} onChange={(v) => setDraft({ ...draft, exchange: v })} options={["NYSE / CME", "Eurex / ICE", "LSE / ICE", "OSE", "NYMEX / ICE", "All venues"]} />
          </MiniField>
          <MiniField label="Country">
            <Select value={draft.country} onChange={(v) => setDraft({ ...draft, country: v })} options={[{ value: "us", label: "United States" }, { value: "gb", label: "United Kingdom" }, { value: "de", label: "Germany" }, { value: "jp", label: "Japan" }, { value: "eu", label: "Euro area" }]} />
          </MiniField>
          <MiniField label="Effect">
            <Select<Holiday["effect"]> value={draft.effect} onChange={(v) => setDraft({ ...draft, effect: v })} options={[{ value: "closed", label: "Closed all day" }, { value: "early-close", label: "Early close" }, { value: "late-open", label: "Late open" }]} />
          </MiniField>
          <MiniField label="Affected symbols" className="col-span-2">
            <Select value={draft.symbols} onChange={(v) => setDraft({ ...draft, symbols: v })} options={["US stocks", "US stocks, US indices", "US stocks, US indices, USOIL", "GER40", "UK100, UKOIL", "JP225", "All CFDs except crypto"]} />
          </MiniField>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {INSTRUMENTS.filter((i) => draft.symbols.includes(i.symbol) || (draft.symbols.includes("US stocks") && i.assetClass === "stocks")).map((i) => (
            <Chip key={i.symbol} size="sm">
              {i.symbol}
            </Chip>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
