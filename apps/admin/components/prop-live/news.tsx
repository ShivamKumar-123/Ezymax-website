"use client";

import * as React from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, IconButton, PageHeader, Reveal, Segmented, type Column } from "@ezymex/ui";
import { MiniField, TextInput } from "@/components/config/kit";
import { TableSkeleton, ago, useApi, useNow } from "@/components/live/kit";
import { FilterPills } from "@/components/prop/rules";
import { PropError, ReadOnlyNote, propWrite, useAction, usePropCan, type NewsEvent } from "./kit";

const utc = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};
const IMPACT_TONE: Record<string, "down" | "warn" | "neutral"> = { high: "down", medium: "warn", low: "neutral" };

export function LiveNewsPage() {
  const now = useNow();
  const canWrite = usePropCan("prop.write");
  const { data, error, reload } = useApi<{ events: NewsEvent[] }>("/api/prop/news", { refreshMs: 60_000 });
  const [when, setWhen] = React.useState<"upcoming" | "past" | "all">("upcoming");
  const all = data?.events ?? [];
  const rows = all
    .filter((e) => (when === "all" ? true : when === "upcoming" ? Date.parse(e.at) >= now - 3600_000 : Date.parse(e.at) < now - 3600_000))
    .sort((a, b) => (when === "past" ? Date.parse(b.at) - Date.parse(a.at) : Date.parse(a.at) - Date.parse(b.at)));
  const act = useAction();

  const remove = (e: NewsEvent) =>
    act.ask({
      title: `Delete ${e.title}`,
      description: `${utc(e.at)} · ${e.currency}. The news-window rule stops applying to this event.`,
      note: "none",
      confirmLabel: "Delete event",
      confirmVariant: "sell",
      run: () => propWrite(`news/${e.id}`, {}, "DELETE"),
      success: "Event deleted",
      onDone: reload,
    });

  const columns: Column<NewsEvent>[] = [
    { key: "at", header: "Time (UTC)", sort: (e) => Date.parse(e.at), csv: (e) => e.at, cell: (e) => <span className="whitespace-nowrap"><span className="k-num block text-[12.5px]">{utc(e.at)}</span><span className="text-[11px] text-fg-3">{ago(e.at, now)}</span></span> },
    { key: "ccy", header: "Currency", sort: (e) => e.currency, csv: (e) => e.currency, cell: (e) => <span className="font-mono text-[12.5px] font-medium">{e.currency}</span> },
    { key: "impact", header: "Impact", sort: (e) => e.impact ?? "", csv: (e) => e.impact ?? "", cell: (e) => <Chip size="sm" dot tone={IMPACT_TONE[e.impact ?? ""] ?? "neutral"} className="capitalize">{e.impact ?? "—"}</Chip> },
    { key: "title", header: "Event", sort: (e) => e.title, csv: (e) => e.title, cell: (e) => <span className="text-[13px]">{e.title}</span> },
    { key: "sym", header: "Instruments", csv: (e) => e.symbols.join(" "), cell: (e) => (e.symbols.length ? <span className="flex flex-wrap gap-1">{e.symbols.map((s) => <Chip key={s} size="sm">{s}</Chip>)}</span> : <span className="text-[12px] text-fg-3">Every {e.currency} pair</span>) },
    { key: "by", header: "Added by", hideOn: "lg", csv: (e) => e.createdBy ?? "", cell: (e) => <span className="text-[12px] text-fg-3">{e.createdBy ?? "—"}</span> },
    ...(canWrite
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (e: NewsEvent) => (
              <IconButton size="sm" aria-label={`Delete ${e.title}`} onClick={() => remove(e)}>
                <Trash2 />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="pb-24">
      <PageHeader title="News calendar" subtitle="High-impact events for the news-window rule. Plans that block news trading close or fail trades opened or closed inside the window." actions={!canWrite ? <ReadOnlyNote what="edit the calendar" /> : undefined} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {canWrite && (
          <Reveal className="xl:col-span-4">
            <AddEvent onAdded={reload} />
          </Reveal>
        )}
        <Reveal delay={0.05} className={canWrite ? "xl:col-span-8" : "xl:col-span-12"}>
          <Card>
            <CardHeader icon={<CalendarClock />} title="Events" subtitle={`${all.length} in the calendar · times are UTC`} />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              {error && !data ? (
                <PropError error={error} onRetry={reload} />
              ) : !data ? (
                <TableSkeleton />
              ) : (
                <DataTable
                  columns={columns}
                  rows={rows}
                  pageSize={20}
                  dense
                  rowKey={(e) => String(e.id)}
                  exportName="prop-news-calendar"
                  search={(e) => `${e.title} ${e.currency} ${e.symbols.join(" ")}`}
                  searchPlaceholder="Event, currency, symbol"
                  toolbar={<FilterPills value={when} onChange={setWhen} options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }, { value: "all", label: "All" }]} />}
                  empty={<div className="py-10 text-center text-[13px] text-fg-3">No events. Add the week&apos;s high-impact releases so the news rule can apply.</div>}
                />
              )}
            </div>
          </Card>
        </Reveal>
      </div>
      {act.node}
    </div>
  );
}

function AddEvent({ onAdded }: { onAdded: () => void }) {
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("12:30");
  const [title, setTitle] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [impact, setImpact] = React.useState<"high" | "medium" | "low">("high");
  const [symbols, setSymbols] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<{ field?: string; message: string } | null>(null);

  const at = date && /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}:00Z` : null;
  const valid = !!at && !Number.isNaN(Date.parse(at)) && title.trim().length > 0 && /^[A-Za-z]{3}$/.test(currency);

  const submit = async () => {
    if (!valid || !at) return;
    setBusy(true);
    setErr(null);
    const res = await propWrite("news", {
      at: new Date(at).toISOString(),
      title: title.trim(),
      currency: currency.toUpperCase(),
      impact,
      symbols: symbols.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean),
    });
    setBusy(false);
    if (!res.ok) {
      setErr({ field: res.error.field, message: res.error.message });
      toast.error("Not added", { description: res.error.message });
      return;
    }
    toast.success("Event added", { description: `${title.trim()} · ${at.replace("T", " ").replace(":00Z", " UTC")}` });
    setTitle("");
    setSymbols("");
    onAdded();
  };

  const fieldCls = "h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-[13.5px] text-fg outline-none focus:border-ember/50 focus:ring-4 focus:ring-ember/10";
  return (
    <Card>
      <CardHeader icon={<Plus />} title="Add event" subtitle="Date and time in UTC" />
      <div className="space-y-4 px-4 pb-6 pt-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Date (UTC)">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} aria-label="Date (UTC)" />
          </MiniField>
          <MiniField label="Time (UTC)">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={fieldCls} aria-label="Time (UTC)" />
          </MiniField>
        </div>
        <MiniField label="Title">
          <TextInput value={title} onChange={setTitle} placeholder="Non-Farm Payrolls" />
        </MiniField>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <MiniField label="Currency">
            <TextInput mono value={currency} onChange={(v) => setCurrency(v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} />
          </MiniField>
          <MiniField label="Impact">
            <Segmented size="md" value={impact} onChange={setImpact} options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
          </MiniField>
        </div>
        <MiniField label="Instruments" hint="Optional · comma separated; empty = every pair with the currency">
          <TextInput mono value={symbols} onChange={setSymbols} placeholder="EURUSD, XAUUSD, US30" />
        </MiniField>
        {err && <div role="alert" className="rounded-[12px] border border-down/30 bg-down-soft px-3 py-2.5 text-[12.5px] text-fg">{err.message}</div>}
        <Button variant="ember" size="sm" className="w-full" disabled={!valid || busy} onClick={submit}>
          {busy ? "Adding…" : "Add to calendar"}
        </Button>
      </div>
    </Card>
  );
}
