// Dates, "time ago", device labels and country names for the profile / security / verification screens, in the
// reader's language (same wording as the Client Area's components/security/common.tsx).
import { intlTag } from "@kalks/i18n/locales";
import { COUNTRIES } from "@/features/auth/countries";
import { i18n } from "@/i18n";

const valid = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "24 Sep, 21:40" (with the year when asked). */
export function when(iso: string | null | undefined, withYear = false): string {
  const d = valid(iso);
  if (!d) return "—";
  try {
    return d.toLocaleString(intlTag(i18n.locale), { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** "24 Sep 2026". */
export function day(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  const d = valid(iso);
  if (!d) return "—";
  try {
    return d.toLocaleDateString(intlTag(i18n.locale), opts);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** A calendar date (YYYY-MM-DD, no time zone) as "31 Jan 1990". */
export function calendarDay(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "—";
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  try {
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intlTag(i18n.locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return ymd;
  }
}

/** "Just now", "12 min ago", "3 h ago", "2 d ago". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  const d = valid(iso);
  if (!d) return "—";
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 90) return i18n.t("security.ago.now");
  if (s < 3600) return i18n.t("security.ago.min", { n: Math.round(s / 60) });
  if (s < 86400) return i18n.t("security.ago.hours", { n: Math.round(s / 3600) });
  return i18n.t("security.ago.days", { n: Math.round(s / 86400) });
}

/** Idle minutes as "30 minutes", "2 hours", "1 day". */
export function idleLabel(min: number): string {
  if (min > 0 && min % 1440 === 0) return i18n.t("security.idle.days", { count: min / 1440 });
  if (min > 0 && min % 60 === 0) return i18n.t("security.idle.hours", { count: min / 60 });
  return i18n.t("security.idle.minutes", { count: min });
}

/** Country name in the reader's language (ISO code), the English list name when Intl can't tell. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  const c = code.trim().toLowerCase();
  try {
    const DN = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of(code: string): string | undefined } }).DisplayNames;
    if (DN) {
      const n = new DN([intlTag(i18n.locale)], { type: "region" }).of(c.toUpperCase());
      if (n && n.toUpperCase() !== c.toUpperCase()) return n;
    }
  } catch {
    // Hermes without Intl.DisplayNames: fall back to the list
  }
  return COUNTRIES.find((x) => x[0] === c)?.[1] ?? c.toUpperCase();
}

export type Device = { browser: string; os: string; kind: "desktop" | "mobile" | "tablet" | "app" | "unknown" };

/** Browser / app, OS and form factor from a user agent (best effort, no external data). */
export function parseDevice(ua: string | null | undefined): Device {
  const t = i18n.t;
  const u = ua ?? "";
  if (!u) return { browser: t("security.device.unknownBrowser"), os: t("security.device.unknownDevice"), kind: "unknown" };
  // the native app: iOS networking (CFNetwork / Darwin) or Android's OkHttp, or Expo Go while testing
  if (/CFNetwork|Darwin\//.test(u) && !/Safari\//.test(u)) return { browser: "Kalks", os: /iPad/.test(u) ? "iPadOS" : "iOS", kind: "app" };
  if (/^okhttp\//i.test(u) || /Expo(Go)?\//.test(u)) return { browser: "Kalks", os: /Darwin|iPhone|iOS/.test(u) ? "iOS" : "Android", kind: "app" };
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
                ? t("security.device.apiClient")
                : t("security.device.browser");
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
                : t("security.device.unknownOs");
  const kind = /iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u)) ? "tablet" : /Mobi|iPhone|Android/.test(u) ? "mobile" : /Windows|Macintosh|Linux|CrOS/.test(u) ? "desktop" : "unknown";
  return { browser, os, kind };
}

/** "Chrome on Windows", "Kalks app on iOS". */
export function deviceLabel(d: Device): string {
  return d.kind === "app" ? i18n.t("mobileProfile.security.appOn", { os: d.os }) : i18n.t("security.device.on", { browser: d.browser, os: d.os });
}

/** KL-000123 */
export const clientId = (id: number | string | undefined | null) => `KL-${String(id ?? 0).padStart(6, "0")}`;

/** Days between a YYYY-MM-DD date and today (local), negative for future dates. */
export function ageDays(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const then = new Date(y, m - 1, d);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - then.getTime()) / 86_400_000);
}

/** A real calendar date in YYYY-MM-DD. */
export function isYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y > 1900;
}

/** Today as YYYY-MM-DD (local). */
export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
