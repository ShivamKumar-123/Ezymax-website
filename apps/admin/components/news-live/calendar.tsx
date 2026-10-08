"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Flame, Newspaper, Pencil, RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, DialogClose, EmptyState, KpiCard, PageHeader, Reveal, Segmented, Skeleton, cn } from "@ezymex/ui";
import { useStaff } from "@/components/staff-session";
import { contentAllows } from "@/lib/academy";
import { NewsError, ago, newsApi, useNews, type AdminCalendar, type CalEvent } from "./api";

const IMPACT = ["Holiday", "Low", "Medium", "High"];

function Bars({ impact }: { impact: number }) {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-label={IMPACT[impact]}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("w-[4px] rounded-full", i <= impact ? (impact === 3 ? "bg-down" : impact === 2 ? "bg-warn" : "bg-fg-2") : "bg-surface-3")} style={{ height: 6 + i * 3 }} />
      ))}
    </span>
  );
}

function EditEvent({ e, onClose, onSaved }: { e: CalEvent | null; onClose: () => void; onSaved: (e: CalEvent) => void }) {
  const [actual, setActual] = React.useState("");
  const [impact, setImpact] = React.useState<string>("feed");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!e) return;
    setActual(e.actual);
    setImpact(e.impactOverride === null ? "feed" : String(e.impactOverride));
  }, [e]);
  if (!e) return null;
  const save = async () => {
    setBusy(true);
    try {
      const r = await newsApi<{ event: CalEvent }>(`calendar/${e.id}`, { method: "PUT", body: { actual: actual.trim(), impact: impact === "feed" ? null : Number(impact) } });
      onSaved(r.event);
      toast.success("Event updated", { description: `${e.currency} ${e.title}` });
      onClose();
    } catch (err) {
      toast.error(err instanceof NewsError ? err.message : "Couldn't save the event");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!e}
      onOpenChange={(o) => !o && onClose()}
      width={520}
      title={`${e.currency} ${e.title}`}
      description={`${e.serverDate} ${e.serverTime} server time · forecast ${e.forecast || "—"} · previous ${e.previous || "—"}`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="ember" size="sm" onClick={save} disabled={busy} data-testid="event-save">
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="block">
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Actual</div>
          <input value={actual} onChange={(x) => setActual(x.target.value)} placeholder="e.g. 4.35%, 254K, -1.2M (empty clears)" className="h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 font-mono text-[13px] outline-none focus:border-ember/50" data-testid="event-actual" />
          <div className="mt-1 text-[11.5px] text-fg-3">The weekly export has no actual values; enter the published figure here. A figure from the feed later replaces it.{e.actualSource ? ` Current value from: ${e.actualSource}.` : ""}</div>
        </label>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Impact</div>
          <Segmented size="xs" value={impact} onChange={setImpact} options={[{ value: "feed", label: `Feed (${IMPACT[e.feedImpact]})` }, { value: "3", label: "High" }, { value: "2", label: "Medium" }, { value: "1", label: "Low" }]} />
        </div>
      </div>
    </Dialog>
  );
}

export function LiveCalendarAdmin() {
  const staff = useStaff();
  const canRead = contentAllows(staff, "content.read");
  const canWrite = contentAllows(staff, "content.write") && (staff.tenant?.slug ?? "ezymex") === "ezymex";
  const [from, setFrom] = React.useState<string | null>(null);
  const [impact, setImpact] = React.useState<"all" | "2" | "3">("2");
  const [editing, setEditing] = React.useState<CalEvent | null>(null);
  const [busy, setBusy] = React.useState(false);
  const cal = useNews<AdminCalendar>(canRead ? (from ? `calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(new Date(Date.parse(from) + 7 * 86400e3).toISOString())}` : "calendar") : null);
  if (!canRead) return <EmptyState illustration="identification_card" title="No access" text="Your role doesn't include content." />;
  if (cal.error && !cal.data) return <EmptyState illustration="satellite_antenna" title="The news service is unavailable" text={cal.error.message} action={<Button variant="surface" onClick={cal.reload}>Try again</Button>} />;
  const d = cal.data;
  const events = (d?.events ?? []).filter((e) => impact === "all" || e.impact >= Number(impact));
  const shift = (n: number) => d && setFrom(new Date(Date.parse(d.from) + n * 7 * 86400e3).toISOString());
  const refresh = async () => {
    setBusy(true);
    try {
      const r = await newsApi<{ result: string }>("calendar/refresh", { method: "POST", body: {} });
      toast.success("Calendar refreshed", { description: r.result });
      cal.reload();
    } catch (e) {
      toast.error(e instanceof NewsError ? e.message : "Couldn't refresh the calendar");
    } finally {
      setBusy(false);
    }
  };
  let lastDay = "";
  const missing = (d?.events ?? []).filter((e) => e.impact === 3 && !e.actual && Date.parse(e.startsAt) < Date.now() && (e.forecast || e.previous)).length;

  return (
    <div className="pb-16">
      <PageHeader
        title="Economic calendar"
        subtitle={`Releases shown in the Client Area, Ezymex Trader and the daily brief. Times in server time (GMT+${d?.serverOffset ?? 3}, New York close).`}
        actions={
          <>
            <Link href="/content/news">
              <Button variant="surface">
                <Newspaper /> News
              </Button>
            </Link>
            {canWrite && (
              <Button variant="surface" onClick={refresh} disabled={busy || (d?.cooldown ?? 0) > 0} data-testid="calendar-refresh">
                <RefreshCw /> {d && d.cooldown > 0 ? `Refresh in ${Math.ceil(d.cooldown / 60)} min` : "Refresh now"}
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Events this week" value={<span className="k-num">{d?.events.length ?? "—"}</span>} icon={<CalendarDays />} chip={d ? `${d.events.filter((e) => e.impact === 3).length} high impact` : undefined} chipTone="down" />
        <KpiCard label="High impact without actual" value={<span className="k-num">{d ? missing : "—"}</span>} icon={<Flame />} chip={d?.licensedActuals ? "licensed provider fills actuals" : "enter published figures"} chipTone={missing ? "warn" : "up"} delay={0.05} />
        <KpiCard label="Client reminders" value={<span className="k-num">{d?.reminders ?? "—"}</span>} icon={<BellRing />} chip={d ? `${d.subscribers} high-impact subscribers` : undefined} delay={0.1} />
        <KpiCard label="Feed" value={<span className="text-[18px]">{d?.source.name ?? "—"}</span>} icon={<RefreshCw />} chip={d ? (d.source.lastError ? `error: ${d.source.lastError.slice(0, 40)}` : `updated ${ago(d.source.lastOkAt)}`) : undefined} chipTone={d?.source.lastError ? "down" : "up"} delay={0.15} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader
            title={d ? `Week of ${new Date(Date.parse(d.from) + (d.serverOffset ?? 3) * 3600e3).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : "Week"}
            subtitle={`${events.length} events`}
            icon={<CalendarDays />}
            action={
              <div className="flex items-center gap-2">
                <Segmented size="xs" value={impact} onChange={setImpact} options={[{ value: "3", label: "High" }, { value: "2", label: "Medium +" }, { value: "all", label: "All" }]} />
                <Button size="sm" variant="surface" onClick={() => shift(-1)} aria-label="Previous week">
                  <ChevronLeft />
                </Button>
                <Button size="sm" variant="surface" onClick={() => setFrom(null)} disabled={!from}>
                  This week
                </Button>
                <Button size="sm" variant="surface" onClick={() => shift(1)} aria-label="Next week">
                  <ChevronRight />
                </Button>
              </div>
            }
          />
          <div className="mt-3 overflow-x-auto px-4 pb-5 sm:px-6">
            {cal.loading && <Skeleton className="h-96 w-full" />}
            {d && events.length === 0 && <div className="py-12 text-center text-[13px] text-fg-3">No events for this week.</div>}
            {events.length > 0 && (
              <table className="w-full min-w-[820px] text-[13px]" data-testid="admin-calendar">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.05em] text-fg-3">
                    <th className="px-2 py-2 font-medium">Time</th>
                    <th className="px-2 py-2 font-medium">Ccy</th>
                    <th className="px-2 py-2 font-medium">Event</th>
                    <th className="px-2 py-2 font-medium">Impact</th>
                    <th className="px-2 py-2 text-right font-medium">Actual</th>
                    <th className="px-2 py-2 text-right font-medium">Forecast</th>
                    <th className="px-2 py-2 text-right font-medium">Previous</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const head = e.serverDate !== lastDay;
                    lastDay = e.serverDate;
                    return (
                      <React.Fragment key={e.id}>
                        {head && (
                          <tr>
                            <td colSpan={8} className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-3">
                              {new Date(`${e.serverDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t border-line hover:bg-surface-2/60">
                          <td className="px-2 py-2 font-mono text-[12.5px] text-fg-2">{e.allDay ? "All day" : e.serverTime}</td>
                          <td className="px-2 py-2">
                            <span className="flex items-center gap-1.5 font-mono text-[12px]">
                              {e.country && <span className={`fi fis fi-${e.country} size-4 rounded-full`} />}
                              {e.currency}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-medium">{e.title}</td>
                          <td className="px-2 py-2">
                            <span className="flex items-center gap-2">
                              <Bars impact={e.impact} />
                              {e.impactOverride !== null && (
                                <Chip size="sm" tone="gold">
                                  edited
                                </Chip>
                              )}
                            </span>
                          </td>
                          <td className={cn("k-num px-2 py-2 text-right font-semibold", e.surprise > 0 ? "text-up" : e.surprise < 0 ? "text-down" : "text-fg")}>
                            {e.actual || <span className="font-normal text-fg-3">—</span>}
                            {e.actualSource === "staff" && <span className="ml-1 text-[10px] font-normal text-fg-3">staff</span>}
                          </td>
                          <td className="k-num px-2 py-2 text-right text-fg-2">{e.forecast || "—"}</td>
                          <td className="k-num px-2 py-2 text-right text-fg-3">{e.previous || "—"}</td>
                          <td className="px-2 py-2 text-right">
                            {canWrite && (
                              <button onClick={() => setEditing(e)} aria-label={`Edit ${e.title}`} className="grid size-7 place-items-center rounded-lg text-fg-3 hover:bg-surface-3 hover:text-fg" data-testid="edit-event">
                                <Pencil className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="border-t border-line px-6 py-3 text-[11.5px] text-fg-3">
            Source: Forex Factory weekly export (polled every 30 minutes with ETag; at most two requests per five minutes). Calendar edits apply to every brand on the platform.
          </div>
        </Card>
      </Reveal>
      <EditEvent
        e={editing}
        onClose={() => setEditing(null)}
        onSaved={(ev) => cal.setData((x) => (x ? { ...x, events: x.events.map((y) => (y.id === ev.id ? { ...y, ...ev } : y)) } : x))}
      />
    </div>
  );
}
