"use client";

// Shared helpers for the live Security and View-only access pages: the security BFF client, device labels
// from user agents, and compact time formatting.

import * as React from "react";
import { Globe2, Laptop, Monitor, Smartphone, Tablet } from "lucide-react";

export type SecError = { status: number; code: string; message: string; field?: string };
export type SecResult<T> = { ok: true; data: T } | { ok: false; error: SecError };

/** Calls the security BFF (/api/security/…). A dead session goes to sign-in. */
export async function secApi<T>(path: string, init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<SecResult<T>> {
  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  try {
    const res = await fetch(`/api/security/${path}`, {
      method,
      headers: method === "GET" ? undefined : { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname)}`);
    }
    const e = (data as { error?: Partial<SecError> }).error ?? {};
    return { ok: false, error: { status: res.status, code: e.code ?? "error", message: e.message ?? "Something went wrong. Please try again.", field: e.field } };
  } catch {
    return { ok: false, error: { status: 0, code: "network", message: "Can't reach Kalks. Check your connection and try again." } };
  }
}

/** Loads `path` once (and on `reload()`), refreshing every `ms` while the tab is visible when `ms` > 0. */
export function useSec<T>(path: string, ms = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<SecError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  React.useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (document.visibilityState === "visible" || tick === 0) {
        const r = await secApi<T>(path);
        if (stop) return;
        if (r.ok) {
          setData(r.data);
          setError(null);
        } else setError(r.error);
      }
      if (!stop && ms > 0) timer = setTimeout(run, ms);
    };
    void run();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [path, ms, tick]);
  return { data, error, reload };
}

export type Device = { browser: string; os: string; kind: "desktop" | "mobile" | "tablet" | "unknown" };

/** Browser, OS and form factor from a user-agent string (best effort, no external data). */
export function parseDevice(ua: string | null | undefined): Device {
  const u = ua ?? "";
  if (!u) return { browser: "Unknown browser", os: "Unknown device", kind: "unknown" };
  const browser = /Edg\//.test(u)
    ? "Edge"
    : /OPR\/|Opera/.test(u)
      ? "Opera"
      : /SamsungBrowser/.test(u)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(u)
          ? "Firefox"
          : /CriOS|Chrome\//.test(u)
            ? "Chrome"
            : /Safari\//.test(u)
              ? "Safari"
              : /curl|python|node|axios/i.test(u)
                ? "API client"
                : "Browser";
  const os = /iPad/.test(u)
    ? "iPadOS"
    : /iPhone|iPod/.test(u)
      ? "iOS"
      : /Android/.test(u)
        ? "Android"
        : /Windows NT/.test(u)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(u)
            ? "macOS"
            : /CrOS/.test(u)
              ? "ChromeOS"
              : /Linux/.test(u)
                ? "Linux"
                : "Unknown OS";
  const kind = /iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u)) ? "tablet" : /Mobi|iPhone|Android/.test(u) ? "mobile" : /Windows|Macintosh|Linux|CrOS/.test(u) ? "desktop" : "unknown";
  return { browser, os, kind };
}

export function DeviceIcon({ kind, className }: { kind: Device["kind"]; className?: string }) {
  const I = kind === "mobile" ? Smartphone : kind === "tablet" ? Tablet : kind === "desktop" ? Laptop : kind === "unknown" ? Globe2 : Monitor;
  return <I className={className} />;
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** "Just now", "12 min ago", "3 h ago", "2 d ago". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 90) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function when(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" });
}

export function day(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Idle minutes as "30 minutes", "2 hours", "1 day". */
export function idleLabel(min: number): string {
  if (min % 1440 === 0) return `${min / 1440} day${min === 1440 ? "" : "s"}`;
  if (min % 60 === 0) return `${min / 60} hour${min === 60 ? "" : "s"}`;
  return `${min} minutes`;
}
