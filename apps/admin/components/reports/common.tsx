"use client";

// Shared pieces of the live Analytics pages (reports service via /api/reports): data hook, period picker,
// export menu with real downloads, loading / error states.

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, Menu, Segmented, Skeleton } from "@ezymex/ui";
import { useCan } from "@/components/staff-session";

export const PERIODS = ["7D", "30D", "90D", "YTD", "1Y"] as const;
export type Period = (typeof PERIODS)[number];

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** [from, to) as server-day dates; `to` = tomorrow so today is included. */
export function periodRange(p: Period): { from: string; to: string; days: number } {
  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() + 1);
  const from = new Date(now);
  if (p === "YTD") from.setMonth(0, 1);
  else from.setDate(from.getDate() - ({ "7D": 7, "30D": 30, "90D": 90, "1Y": 365 } as const)[p] + 1);
  return { from: isoDay(from), to: isoDay(to), days: Math.round((to.getTime() - from.getTime()) / 86400_000) };
}

export class ReportError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function reportsApi<T>(path: string, init?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown }): Promise<T> {
  const method = init?.method ?? "GET";
  const res = await fetch(`/api/reports/${path}`, {
    method,
    cache: "no-store",
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(init?.body ?? {}),
  });
  if (res.status === 401) {
    window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ReportError("Your session has ended.", 401);
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ReportError(j?.error?.message ?? "Reports are unavailable right now.", res.status);
  return j as T;
}

export function useReport<T>(path: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    if (!path) return;
    let stop = false;
    setLoading(true);
    reportsApi<T>(path)
      .then((d) => {
        if (stop) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !stop && setError(e instanceof Error ? e.message : "Reports are unavailable right now."))
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
  }, [path, nonce]);
  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return <Segmented value={value} onChange={onChange} options={PERIODS} />;
}

export function download(url: string, label: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast.success("Export started", { description: label });
}

/** Schedule shortcut + CSV / Excel export of a report for the period (needs reports.export). `query` adds report
 *  parameters (e.g. the traders period and filters). */
export function ExportMenu({ report, name, from, to, query }: { report: string; name: string; from: string; to: string; query?: Record<string, string> }) {
  const canExport = useCan("reports.export");
  const extra = new URLSearchParams(Object.entries(query ?? {}).filter(([, v]) => v !== "")).toString();
  const url = (f: "csv" | "xlsx") => `/api/reports/export/${report}?from=${from}&to=${to}&format=${f}${extra ? `&${extra}` : ""}`;
  return (
    <>
      <Link href="/analytics/scheduled">
        <Button variant="surface" size="md">
          <CalendarClock /> Schedule
        </Button>
      </Link>
      {canExport && (
        <Menu
          trigger={
            <Button variant="ember" size="md">
              <Download /> Export
            </Button>
          }
          items={[
            { label: "Excel", icon: <FileSpreadsheet />, hint: ".xlsx", onSelect: () => download(url("xlsx"), `${name} · Excel`) },
            { label: "CSV", icon: <FileText />, hint: ".csv", onSelect: () => download(url("csv"), `${name} · CSV`) },
          ]}
        />
      )}
    </>
  );
}

export function ReportLoading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-[380px] w-full rounded-[20px]" />
    </div>
  );
}

export function ReportFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <EmptyState
        illustration="bar_chart"
        title="This report couldn't be loaded"
        text={message}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        }
      />
    </Card>
  );
}

export const money0 = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const money2 = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function chg(a: number, b: number) {
  return b ? ((a - b) / Math.abs(b)) * 100 : 0;
}

export function countryName(code: string) {
  if (!code || code === "--") return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
