"use client";

// Shared helpers for the live Security and View-only access pages: the security BFF client, device labels
// from user agents, and compact time formatting.

import * as React from "react";
import { Globe2, Laptop, Monitor, Smartphone, Tablet } from "lucide-react";
import { intlTag, type T } from "@kalks/i18n";
import { tr } from "@kalks/i18n/react";

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
    return { ok: false, error: { status: res.status, code: e.code ?? "error", message: e.message ?? tr("security.error.generic"), field: e.field } };
  } catch {
    return { ok: false, error: { status: 0, code: "network", message: tr("security.error.network") } };
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

export type Device = {
  browser: string;
  os: string;
  kind: "desktop" | "mobile" | "tablet" | "app" | "unknown";
  /** The phone a session of the mobile app runs on ("iPhone", "Pixel 8", "Android"). */
  device?: string;
};

/**
 * A session of the mobile app. The app talks to the server with the phone's own networking, not a browser: iOS
 * sends `<App>/<build> CFNetwork/… Darwin/…` (the app is iPhone-only: an iPad runs it as an iPhone app), Android
 * `okhttp/…` or `Dalvik/… (Linux; U; Android 14; <model> Build/…)`.
 */
function appDevice(u: string): Device | null {
  if (/Safari\/|Chrome\/|Firefox\//.test(u)) return null;
  if (/CFNetwork\/|Darwin\//.test(u)) return { browser: "app", os: "iOS", kind: "app", device: "iPhone" };
  const dalvik = /Dalvik\/[\d.]+ \(Linux; U; Android [\d.]+; ([^;)]+?)(?: Build\/[^)]*)?\)/.exec(u);
  if (dalvik) return { browser: "app", os: "Android", kind: "app", device: dalvik[1]!.trim() || "Android" };
  if (/^okhttp\//i.test(u)) return { browser: "app", os: "Android", kind: "app", device: "Android" };
  return null;
}

/** Browser (or the mobile app), OS and form factor from a user-agent string (best effort, no external data). */
export function parseDevice(ua: string | null | undefined): Device {
  const u = ua ?? "";
  if (!u) return { browser: tr("security.device.unknownBrowser"), os: tr("security.device.unknownDevice"), kind: "unknown" };
  const app = appDevice(u);
  if (app) return app;
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
                ? tr("security.device.apiClient")
                : tr("security.device.browser");
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
                : tr("security.device.unknownOs");
  const kind = /iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u)) ? "tablet" : /Mobi|iPhone|Android/.test(u) ? "mobile" : /Windows|Macintosh|Linux|CrOS/.test(u) ? "desktop" : "unknown";
  return { browser, os, kind };
}

/** "Chrome on Windows"; a session of the mobile app reads "Kalks app · iPhone" (`brand`: the broker's name). */
export function deviceName(d: Device, brand: string): string {
  return d.kind === "app" ? tr("security.device.app", { brand, device: d.device ?? d.os }) : tr("security.device.on", { browser: d.browser, os: d.os });
}

export function DeviceIcon({ kind, className }: { kind: Device["kind"]; className?: string }) {
  const I = kind === "mobile" || kind === "app" ? Smartphone : kind === "tablet" ? Tablet : kind === "desktop" ? Laptop : kind === "unknown" ? Globe2 : Monitor;
  return <I className={className} />;
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([intlTag(tr.locale)], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** "Just now", "12 min ago", "3 h ago", "2 d ago". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 90) return tr("security.ago.now");
  if (s < 3600) return tr("security.ago.min", { n: Math.round(s / 60) });
  if (s < 86400) return tr("security.ago.hours", { n: Math.round(s / 3600) });
  return tr("security.ago.days", { n: Math.round(s / 86400) });
}

export function when(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(intlTag(tr.locale), { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" });
}

export function day(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(intlTag(tr.locale), { day: "numeric", month: "short", year: "numeric" });
}

/** Idle minutes as "30 minutes", "2 hours", "1 day". */
/** "1 day", "2 hours", "30 minutes". Pass the component's `t` when it renders on the server too (the global `tr`
 *  follows the browser's language only once the page runs in the browser). */
export function idleLabel(min: number, t: T = tr): string {
  if (min % 1440 === 0) return t("security.idle.days", { count: min / 1440 });
  if (min % 60 === 0) return t("security.idle.hours", { count: min / 60 });
  return t("security.idle.minutes", { count: min });
}
