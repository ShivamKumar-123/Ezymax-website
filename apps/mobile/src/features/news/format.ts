// Time and label helpers for news and the calendar. Clock times are 24-hour with Latin digits (the MT5 convention the
// rest of the trading screens use); weekday and month names follow the reader's language.
import type { T } from "@/i18n";
import type { Formatter } from "@kalks/i18n/format";
import type { CalEvent } from "./api";

const pad = (n: number) => String(n).padStart(2, "0");

/** "just now" / "5m ago" / "2h 10m ago" / "yesterday" / "3 days ago" (the web's wording, translated). */
export function ago(t: T, iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return t("news.ago.justNow");
  if (m < 60) return t("news.ago.minutes", { m });
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? t("news.ago.hoursMinutes", { h, m: m % 60 }) : t("news.ago.hours", { h });
  const d = Math.floor(h / 24);
  return d === 1 ? t("news.ago.yesterday") : t("news.ago.days", { count: d });
}

/** HH:MM on the phone's clock. */
export function localHm(iso: string | number): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** YYYY-MM-DD of the phone's calendar day. */
export function localDay(iso: string | number): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD / HH:MM in server time, for "now" (server offset in hours). */
export function serverDay(ms: number, offsetH: number): string {
  return new Date(ms + offsetH * 3_600_000).toISOString().slice(0, 10);
}
export function serverHm(ms: number, offsetH: number): string {
  return new Date(ms + offsetH * 3_600_000).toISOString().slice(11, 16);
}

/** "GMT+3", "GMT+5:30", "GMT−4" from an offset in minutes east of UTC. */
export function gmt(offsetMin: number): string {
  const sign = offsetMin < 0 ? "−" : "+";
  const a = Math.abs(offsetMin);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `GMT${sign}${h}${m ? `:${pad(m)}` : ""}`;
}
export const localOffsetMin = () => -new Date().getTimezoneOffset();

/** A calendar day key (YYYY-MM-DD) as a Date at noon UTC, for weekday / month names without zone drift. */
const noonUtc = (day: string) => new Date(`${day}T12:00:00Z`);
export const weekdayShort = (f: Formatter, day: string) => f.date(noonUtc(day), { weekday: "short", timeZone: "UTC" });
export const weekdayLong = (f: Formatter, day: string) => f.date(noonUtc(day), { weekday: "long", timeZone: "UTC" });
export const dayNum = (day: string) => String(Number(day.slice(8, 10)));
export const dayMonth = (f: Formatter, day: string) => f.date(noonUtc(day), { day: "numeric", month: "short", timeZone: "UTC" });
export const dayMonthYear = (f: Formatter, day: string) => f.date(noonUtc(day), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Days / hours / minutes / seconds left, e.g. "04:15:09" or "2d 04:15:09". */
export function countdown(t: T, ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const time = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? t("news.countdown.days", { d, time }) : time;
}

export type Zone = "local" | "server";

/** The day an event is listed under and the time shown on its row, in the chosen zone. */
export const eventDay = (e: CalEvent, zone: Zone) => (zone === "server" ? e.serverDate : localDay(e.startsAt));
export function eventTime(t: T, e: CalEvent, zone: Zone): string {
  if (e.allDay) return t("news.cal.allDay");
  return zone === "server" ? e.serverTime : localHm(e.startsAt);
}

/** A story's host name for the "Read at source" line (www. dropped). */
export function hostOf(link: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(link.trim());
  return m ? m[1]!.replace(/^www\./i, "").toLowerCase() : "";
}

/** Numeric value of a calendar figure ("4.35%", "250K", "-1.2M", "<0.1%"), for the history bars. */
export function figure(s: string): number | null {
  const m = s.trim().replace(/^[<>~]/, "").replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([KMBT%]?)$/i);
  return m ? Number(m[1]) : null;
}
export const unitOf = (s: string) => s.trim().match(/[KMBT%]$/i)?.[0] ?? "";
