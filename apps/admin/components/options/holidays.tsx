"use client";

/**
 * Options › Holidays (O44): the bank-holiday calendar per currency (XAU / XAG use London + New York, oil New York),
 * seeded for 2026–2028 and editable here. An expiry must be a business day in every calendar of its pair and New
 * York, otherwise it rolls back to the previous business day; the vol clock also weights holidays.
 *
 *   GET    /api/options/holidays?calendar=&year=        {calendars[], holidays[]} (disabled rows included)
 *   PUT    /api/options/holidays/{cal}/{day}            {name, active, reason}   add / rename / restore
 *   DELETE /api/options/holidays/{cal}/{day}            {reason}                 disable (kept so the seed won't re-add it)
 */
import * as React from "react";
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, RotateCcw, Undo2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, Field, IconButton, Input, KpiCard, PageHeader, Reveal, Toggle, cn } from "@ezymex/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import type { Holiday, Underlying } from "./types";
import { ReadOnlyHint, REASONS, ReasonDialog, optSend, platformBlock, useOpt, useOptPerms } from "./kit";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const CAL_NAME: Record<string, string> = { USD: "United States (New York)", EUR: "Eurozone (TARGET2)", GBP: "United Kingdom (London)", JPY: "Japan (Tokyo)", CHF: "Switzerland (Zurich)", AUD: "Australia (Sydney)", CAD: "Canada (Toronto)", NZD: "New Zealand (Wellington)", XAU: "Gold (London bullion market)", XAG: "Silver (London bullion market)", OIL: "Oil (NYMEX)" };

type Edit = { mode: "add" | "edit" | "remove" | "restore"; day: string; h?: Holiday };

export function HolidaysPage() {
  const perms = useOptPerms();
  const block = platformBlock(perms);
  const now = useNow();
  const thisYear = new Date(now).getUTCFullYear();
  const [cal, setCal] = React.useState("USD");
  const [year, setYear] = React.useState(thisYear);
  const { data, error, reload } = useOpt<{ calendars: string[]; holidays: Holiday[] }>(`/api/options/holidays?calendar=${cal}&year=${year}`);
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const [edit, setEdit] = React.useState<Edit | null>(null);
  const list = data?.holidays.filter((h) => h.calendar === cal && h.day.startsWith(String(year))) ?? null;
  const byDay = new Map((list ?? []).map((h) => [h.day, h]));
  const active = (list ?? []).filter((h) => h.active);
  const usedBy = (unders.data?.underlyings ?? []).filter((u) => (u.calendarCodes ?? [...u.calendars, "USD"]).includes(cal)).map((u) => u.symbol);
  const today = new Date(now).toISOString().slice(0, 10);
  const next = active.find((h) => h.day >= today);
  const calendars = data?.calendars?.length ? data.calendars : ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "OIL", "USD", "XAG", "XAU"];

  const onDay = (d: string) => {
    const h = byDay.get(d);
    if (block) return;
    setEdit(h ? { mode: "edit", day: d, h } : { mode: "add", day: d });
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Holidays"
        subtitle="Bank holidays per currency calendar. Expiries roll back to the previous business day of every calendar in the pair plus New York; holidays also slow the vol clock."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {!block && (
              <Button variant="ember" size="lg" onClick={() => setEdit({ mode: "add", day: `${year}-${String(new Date(now).getUTCMonth() + 1).padStart(2, "0")}-01` })}>
                <Plus /> Add holiday
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Calendar">
          {calendars.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={c === cal} onClick={() => setCal(c)} className={cn("rounded-full border px-3 py-1.5 font-mono text-[12.5px]", c === cal ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}>
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton size="sm" aria-label="Previous year" onClick={() => setYear((y) => y - 1)} disabled={year <= 2026}>
            <ChevronLeft />
          </IconButton>
          <span className="k-num w-14 text-center font-mono text-[14px] font-medium">{year}</span>
          <IconButton size="sm" aria-label="Next year" onClick={() => setYear((y) => y + 1)} disabled={year >= thisYear + 3}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label={`${cal} holidays ${year}`} icon={<CalendarDays />} value={<span className="k-num">{active.length}</span>} chip={CAL_NAME[cal] ?? cal} />
        <KpiCard label="Next" icon={<CalendarX2 />} value={<span className="k-num text-[22px]">{next ? next.day.slice(5) : "—"}</span>} chip={next?.name ?? "none left this year"} delay={0.04} />
        <KpiCard label="Disabled" icon={<RotateCcw />} value={<span className="k-num">{(list ?? []).filter((h) => !h.active).length}</span>} chip="kept so the seed won't re-add them" delay={0.08} />
        <KpiCard label="Used by" icon={<CalendarDays />} value={<span className="k-num">{usedBy.length}</span>} chip={usedBy.slice(0, 4).join(" · ") || "no underlying"} delay={0.12} />
      </div>

      {error ? (
        <Card className="mt-4">
          <ErrorState error={error} onRetry={reload} />
        </Card>
      ) : !list ? (
        <TableSkeleton rows={8} className="mt-4" />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-12">
          <Reveal delay={0.05} className="2xl:col-span-8">
            <Card className="pb-5">
              <CardHeader title={`${CAL_NAME[cal] ?? cal} · ${year}`} subtitle={block ? "Holidays are marked. Weekends are never business days." : "Click a date to add a holiday, or a marked one to edit it."} action={<ReadOnlyHint text={block} />} />
              <div className="mt-4 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-4">
                {MONTHS.map((m, i) => (
                  <Month key={m} year={year} month={i} byDay={byDay} today={today} onDay={onDay} readOnly={!!block} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 px-6 text-[11.5px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-ember" /> holiday
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] border border-dashed border-fg-3" /> disabled
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-surface-3" /> weekend
                </span>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.08} className="2xl:col-span-4">
            <Card className="pb-4">
              <CardHeader title="List" subtitle={`${list.length} dates in ${year}`} />
              <div className="mt-3 max-h-[680px] space-y-1.5 overflow-y-auto px-4">
                {!list.length ? (
                  <EmptyState title="No holidays" text={`Nothing in the ${cal} calendar for ${year}.`} illustration="calendar" />
                ) : (
                  list.map((h) => (
                    <div key={h.day} className={cn("k-row flex items-center gap-3 px-3 py-2", !h.active && "opacity-60")}>
                      <div className="w-14 shrink-0 text-center">
                        <div className="text-[10px] uppercase text-fg-3">{MONTHS[Number(h.day.slice(5, 7)) - 1]!.slice(0, 3)}</div>
                        <div className="k-num text-[17px] font-medium leading-tight">{Number(h.day.slice(8))}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-[12.5px]", !h.active && "line-through")}>{h.name}</div>
                        <div className="truncate text-[10.5px] text-fg-3" title={when(h.updatedAt)}>
                          {weekday(h.day)} · {h.source === "seed" ? "seed" : `${h.updatedBy} · ${ago(h.updatedAt, now)}`}
                        </div>
                      </div>
                      {!h.active && <Chip size="sm">off</Chip>}
                      {!block &&
                        (h.active ? (
                          <span className="flex gap-0.5">
                            <IconButton size="sm" aria-label={`Rename ${h.name}`} onClick={() => setEdit({ mode: "edit", day: h.day, h })}>
                              <Pencil />
                            </IconButton>
                            <IconButton size="sm" aria-label={`Remove ${h.name}`} onClick={() => setEdit({ mode: "remove", day: h.day, h })}>
                              <CalendarX2 />
                            </IconButton>
                          </span>
                        ) : (
                          <IconButton size="sm" aria-label={`Restore ${h.name}`} onClick={() => setEdit({ mode: "restore", day: h.day, h })}>
                            <Undo2 />
                          </IconButton>
                        ))}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </Reveal>
        </div>
      )}
      <HolidayDialog cal={cal} edit={edit} onClose={() => setEdit(null)} onSaved={reload} />
    </div>
  );
}

function weekday(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

function Month({ year, month, byDay, today, onDay, readOnly }: { year: number; month: number; byDay: Map<string, Holiday>; today: string; onDay: (d: string) => void; readOnly: boolean }) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div className="rounded-[16px] border border-line bg-surface-2/40 p-3">
      <div className="mb-2 text-[12.5px] font-medium">{MONTHS[month]}</div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WD.map((w) => (
          <span key={w} className="text-[9.5px] uppercase text-fg-3">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const h = byDay.get(ds);
          const weekend = i % 7 >= 5;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => onDay(ds)}
              disabled={readOnly && !h}
              title={h ? `${h.name}${h.active ? "" : " (disabled)"}` : weekend ? "Weekend" : readOnly ? ds : `Add a holiday on ${ds}`}
              className={cn(
                "k-num grid h-7 place-items-center rounded-[7px] text-[11.5px] transition-colors",
                h?.active ? "bg-ember font-medium text-white hover:brightness-110" : h ? "border border-dashed border-fg-3 text-fg-3 line-through" : weekend ? "bg-surface-3/70 text-fg-3" : "text-fg-2 hover:bg-surface-3",
                ds === today && "ring-1 ring-fg",
                readOnly && !h && "cursor-default hover:bg-transparent",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HolidayDialog({ cal, edit, onClose, onSaved }: { cal: string; edit: Edit | null; onClose: () => void; onSaved: () => void }) {
  const [day, setDay] = React.useState("");
  const [name, setName] = React.useState("");
  const [active, setActive] = React.useState(true);
  React.useEffect(() => {
    if (!edit) return;
    setDay(edit.day);
    setName(edit.h?.name ?? "");
    setActive(edit.mode === "restore" ? true : (edit.h?.active ?? true));
  }, [edit]);
  const mode = edit?.mode ?? "add";
  const wd = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00Z`).getUTCDay() : -1;
  const invalid = mode === "remove" ? null : !/^\d{4}-\d{2}-\d{2}$/.test(day) ? "Pick a date" : !name.trim() ? "Enter the holiday's name" : mode === "edit" && name.trim() === edit?.h?.name && active === edit?.h?.active ? "Nothing changed yet" : null;
  const title = mode === "add" ? `Add a ${cal} holiday` : mode === "remove" ? `Remove ${edit?.h?.name}` : mode === "restore" ? `Restore ${edit?.h?.name}` : `Edit ${edit?.h?.name}`;
  return (
    <ReasonDialog
      open={!!edit}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={mode === "remove" ? `${cal} · ${day}: it becomes a business day again. The date is kept (disabled) so the yearly seed doesn't add it back.` : `${cal} calendar. Expiries listed on this date move to the previous business day at the next listing run.`}
      codes={REASONS.holiday}
      confirmLabel={mode === "remove" ? "Remove holiday" : mode === "restore" ? "Restore holiday" : "Save holiday"}
      confirmVariant={mode === "remove" ? "down-outline" : "ember"}
      disabled={invalid}
      onConfirm={async (reason) => {
        const r = mode === "remove" ? await optSend("DELETE", `/api/options/holidays/${cal}/${day}`, { reason }) : await optSend("PUT", `/api/options/holidays/${cal}/${day}`, { name: name.trim(), active, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success={mode === "remove" ? `${cal} ${day} is a business day again` : `${cal} ${day} saved`}
    >
      {mode !== "remove" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" hint={wd === 0 || wd === 6 ? "a weekend: already closed" : undefined}>
            <Input type="date" value={day} disabled={mode !== "add"} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Holiday name" placeholder="e.g. Thanksgiving Day" />
          </Field>
          {mode === "edit" && (
            <label className="col-span-2 flex items-center gap-2 text-[12.5px]">
              <Toggle checked={active} onChange={setActive} label="Active" /> Active (a non-business day)
            </label>
          )}
        </div>
      )}
    </ReasonDialog>
  );
}
