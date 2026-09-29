// Times in chats are the reader's own clock (not server time): "14:02", and day dividers "Today" / "Yesterday" /
// "24 Sep 2026".
import type { Formatter } from "@kalks/i18n/format";
import type { T } from "@/i18n";

type DateInput = string | number | Date;

export function clock(fmt: Formatter, d: DateInput): string {
  try {
    return fmt.time(d, { hour: "2-digit", minute: "2-digit", timeZone: undefined });
  } catch {
    return "";
  }
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function sameDay(a: DateInput, b: DateInput): boolean {
  return dayKey(new Date(a)) === dayKey(new Date(b));
}

export function dayLabel(t: T, fmt: Formatter, d: DateInput, now = Date.now()): string {
  const date = new Date(d);
  if (dayKey(date) === dayKey(new Date(now))) return t("common.today");
  if (dayKey(date) === dayKey(new Date(now - 86_400_000))) return t("common.yesterday");
  return fmt.date(date, { day: "numeric", month: "short", year: date.getFullYear() === new Date(now).getFullYear() ? undefined : "numeric", timeZone: undefined });
}
