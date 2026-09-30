// Where the Trade tab links for its symbol: the symbol's stories (/news?symbol=) and the economic calendar of the
// symbol's currency (/calendar?currency=). Both are warmed on press-in, like every other entry point; the News and
// Calendar screens read the same caches (src/features/news/api.ts).
import type { Href } from "expo-router";
import { prefetch } from "@/lib/query";
import { instruments } from "@/market/instruments";
import { CURRENCIES, cleanSymbol, fetchBrief, fetchFeed, keys, NO_FILTERS, prefetchCalendar } from "../news/api";
import { calendarCurrency as calendarCurrencyOf, matchSymbol } from "./currencies";

/** The calendar to open for a symbol (its base currency when the calendar covers it, else its quote currency). */
export const calendarCurrency = (symbol: string) => calendarCurrencyOf(symbol, CURRENCIES);

/** News for the symbol, when the news service can tag it (plain letters and digits); null otherwise. */
export function newsHref(symbol: string): Href | null {
  const s = cleanSymbol(symbol);
  return s ? { pathname: "/news", params: { symbol: s } } : null;
}

export function calendarHref(symbol: string): Href {
  return { pathname: "/calendar", params: { currency: calendarCurrency(symbol) } };
}

/** Press-in on the News link: the brief and the symbol's first page, under the keys the News screen reads. */
export function warmNews(symbol: string) {
  const s = cleanSymbol(symbol);
  if (!s) return;
  const f = { ...NO_FILTERS, symbol: s };
  prefetch(keys.brief, fetchBrief, { persist: true, staleMs: 10 * 60_000 });
  prefetch(keys.feed(f), fetchFeed(f), { persist: true, staleMs: 60_000 });
}

/** Press-in on the Calendar link: this week and the next high-impact event (the currency filters on the phone). */
export const warmCalendar = prefetchCalendar;

/** The symbol a link asked for, as the catalogue spells it (null: not a symbol the catalogue has). */
export const linkedSymbol = (raw: unknown) =>
  matchSymbol(
    raw,
    instruments().map((i) => i.symbol),
  );
