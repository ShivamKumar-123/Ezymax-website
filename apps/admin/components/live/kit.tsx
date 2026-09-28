"use client";

/**
 * Live-mode building blocks: fetching from the Back Office BFF (/api/admin/*), formatting of real timestamps,
 * CSV export, pagination and loading / error states.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, EmptyState, IconButton, Skeleton, cn, formatDateTime, type ChipTone } from "@kalks/ui";

export type ApiErr = { code: string; message: string; field?: string };

function expired() {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`/api/auth/expired?next=${encodeURIComponent(next)}`);
}

/** GET a BFF endpoint. `url = null` skips the request. Re-fetches when `url` changes; `reload()` forces it. */
export function useApi<T>(url: string | null, opts: { refreshMs?: number } = {}) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<ApiErr | null>(null);
  const [loading, setLoading] = React.useState(!!url);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    fetch(url, { cache: "no-store", credentials: "same-origin" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.status === 401) return expired();
        if (!r.ok) {
          setError(body?.error ?? { code: "unknown", message: "Something went wrong." });
          return;
        }
        setError(null);
        setData(body as T);
      })
      .catch(() => alive && setError({ code: "network", message: "Can't reach the Back Office server." }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, tick]);
  React.useEffect(() => {
    if (!url || !opts.refreshMs) return;
    const t = setInterval(() => setTick((n) => n + 1), opts.refreshMs);
    return () => clearInterval(t);
  }, [url, opts.refreshMs]);
  const reload = React.useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

/** POST/PUT JSON to a BFF endpoint. */
export async function sendJson<T>(url: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<{ ok: true; data: T } | { ok: false; error: ApiErr }> {
  try {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      expired();
      return { ok: false, error: { code: "unauthorized", message: "Your session has ended." } };
    }
    if (r.ok) return { ok: true, data: data as T };
    return { ok: false, error: data?.error ?? { code: "unknown", message: "Something went wrong." } };
  } catch {
    return { ok: false, error: { code: "network", message: "Can't reach the Back Office server." } };
  }
}

export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== "all") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ---------- formatting ---------- */

/** "28 Sep 2026, 14:27" in server time (GMT+3). */
export function when(iso: string | null | undefined, withSeconds = false) {
  if (!iso) return "—";
  return formatDateTime(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}), hour12: false });
}

export function day(iso: string | null | undefined) {
  if (!iso) return "—";
  return formatDateTime(iso, { day: "2-digit", month: "short", year: "numeric" });
}

/** Relative time against the real clock; re-renders every 30s via useNow(). */
export function ago(iso: string | null | undefined, now: number) {
  if (!iso) return "never";
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))}m`;
    if (f < 86400) return `in ${Math.round(f / 3600)}h`;
    return `in ${Math.round(f / 86400)}d`;
  }
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return day(iso);
}

export function useNow(ms = 30_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

let regionNames: Intl.DisplayNames | null = null;
export function countryName(code: string) {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** "Chrome 131 · macOS" from a user-agent string. */
export function device(ua: string | null | undefined) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const m =
    ua.match(/Edg\/(\d+)/) ? ["Edge", ua.match(/Edg\/(\d+)/)![1]] :
    ua.match(/OPR\/(\d+)/) ? ["Opera", ua.match(/OPR\/(\d+)/)![1]] :
    ua.match(/Firefox\/(\d+)/) ? ["Firefox", ua.match(/Firefox\/(\d+)/)![1]] :
    ua.match(/HeadlessChrome\/(\d+)/) ? ["Headless Chrome", ua.match(/HeadlessChrome\/(\d+)/)![1]] :
    ua.match(/Chrome\/(\d+)/) ? ["Chrome", ua.match(/Chrome\/(\d+)/)![1]] :
    ua.match(/Version\/(\d+).*Safari/) ? ["Safari", ua.match(/Version\/(\d+)/)![1]] :
    ua.startsWith("node") || ua.startsWith("undici") ? ["Server", ""] :
    ua.startsWith("curl") ? ["curl", ""] : null;
  const browser = m ? `${m[0]}${m[1] ? ` ${m[1]}` : ""}` : ua.slice(0, 24);
  return os ? `${browser} · ${os}` : browser;
}

/** Tone for an audit action. */
export function actionTone(action: string): ChipTone {
  if (/failed|locked|rejected|blocked/.test(action)) return "down";
  if (/revoked|reset|logout/.test(action)) return "warn";
  if (/login|verified|register|seeded/.test(action)) return "up";
  if (/^spreads\./.test(action)) return "ember";
  return "neutral";
}

/** Readable label for an audit action code. */
export function actionLabel(action: string) {
  const map: Record<string, string> = {
    "user.register": "Client registered",
    "user.login": "Client signed in",
    "user.login_failed": "Client sign-in failed",
    "user.locked": "Client locked out",
    "user.logout": "Client signed out",
    "user.email_verified": "Client email verified",
    "user.password_reset_requested": "Client password reset requested",
    "user.password_reset": "Client password reset",
    "staff.login": "Staff signed in",
    "staff.login_failed": "Staff sign-in failed",
    "staff.locked": "Staff locked out",
    "staff.logout": "Staff signed out",
    "staff.seeded": "Staff account created",
    "admin.session_revoked": "Session revoked",
    "spreads.update": "Spread markup changed",
    "share.created": "Trade share link created",
    "share.revoked": "Trade share link revoked",
  };
  return map[action] ?? action;
}

/* ---------- CSV ---------- */

export function downloadCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${name}.csv downloaded`, { description: `${rows.length} rows` });
}

/* ---------- states ---------- */

export function ErrorState({ error, onRetry, className }: { error: ApiErr; onRetry?: () => void; className?: string }) {
  const forbidden = error.code === "forbidden";
  return (
    <EmptyState
      className={className}
      illustration={forbidden ? "locked" : "warning"}
      title={forbidden ? "Not available for your role" : "Couldn't load this"}
      text={forbidden ? "Ask a Super Admin if you need access." : error.message}
      action={
        !forbidden && onRetry ? (
          <Button variant="surface" size="sm" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-11 w-full rounded-[14px]" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-[12.5px] text-fg-3">
      <span className="k-num">
        {(page - 1) * perPage + 1}–{Math.min(total, page * perPage)} of {total.toLocaleString("en-US")}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <IconButton size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            <ChevronLeft />
          </IconButton>
          <span className="k-num px-2">
            {page} / {pages}
          </span>
          <IconButton size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
            <ChevronRight />
          </IconButton>
        </div>
      )}
    </div>
  );
}

export function KycChip({ status }: { status: string }) {
  const map: Record<string, { tone: ChipTone; label: string }> = {
    verified: { tone: "up", label: "KYC verified" },
    pending: { tone: "warn", label: "KYC pending" },
    rejected: { tone: "down", label: "KYC rejected" },
    unverified: { tone: "neutral", label: "No KYC" },
  };
  const s = map[status] ?? { tone: "neutral" as ChipTone, label: status };
  return (
    <Chip size="sm" tone={s.tone} dot>
      {s.label}
    </Chip>
  );
}

export function EmailChip({ verified }: { verified: boolean }) {
  return (
    <Chip size="sm" tone={verified ? "up" : "warn"} dot>
      {verified ? "Email verified" : "Email unverified"}
    </Chip>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[12.5px]", className)}>{children}</span>;
}

/** Filter pill select (native select styled like the kit). */
export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 pl-3.5 pr-2 text-[12.5px] text-fg-3">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full max-w-48 bg-transparent pr-1 text-fg outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-fg">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
