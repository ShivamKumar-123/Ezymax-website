"use client";

// Symbol display for anything the trading engine sends: CFD symbols, Ezymex FX Options series codes
// (`EURUSD-20261002-1.1000-C`) and symbols the static instrument list (@ezymex/mock INSTRUMENTS) doesn't carry.
// `SymbolAvatar` / `SymbolCell` from @ezymex/ui look the symbol up in that list and throw for anything else, so
// engine data goes through `TradeSymbolAvatar` / `TradeSymbolCell` here instead.

import * as React from "react";
import { SymbolAvatar, cn } from "@/components/kit";
import { INSTRUMENT_MAP } from "@ezymex/mock";
import { intlTag } from "@ezymex/i18n/locales";
import type { T } from "@ezymex/i18n";
import { useT } from "@ezymex/i18n/react";
import { fmtAmount, fmtPrice } from "./api";
import { optionTerms, parseSeries, type DealOption, type OptionTerms, type PositionOption } from "./option-deal";

const CCY_FLAG: Record<string, string> = {
  EUR: "eu", GBP: "gb", USD: "us", JPY: "jp", AUD: "au", CAD: "ca", CHF: "ch", NZD: "nz", INR: "in", SGD: "sg", HKD: "hk",
  ZAR: "za", MXN: "mx", NOK: "no", SEK: "se", DKK: "dk", PLN: "pl", TRY: "tr", CNH: "cn", CNY: "cn", HUF: "hu", CZK: "cz",
};

/** The list's avatar when it knows the symbol, two flags for other currency pairs, initials otherwise. */
function BaseAvatar({ symbol, size }: { symbol: string; size: number }) {
  if (INSTRUMENT_MAP[symbol]) return <SymbolAvatar symbol={symbol} size={size} />;
  const base = symbol.length === 6 ? CCY_FLAG[symbol.slice(0, 3)] : undefined;
  const quote = symbol.length === 6 ? CCY_FLAG[symbol.slice(3, 6)] : undefined;
  if (base && quote)
    return (
      <span className="relative inline-block shrink-0" style={{ width: size * 1.45, height: size }}>
        <span className={cn("fi fis absolute left-0 top-0 rounded-full ring-2 ring-surface", `fi-${base}`)} style={{ width: size, height: size }} />
        <span className={cn("fi fis absolute right-0 top-0 rounded-full ring-2 ring-surface", `fi-${quote}`)} style={{ width: size, height: size }} />
      </span>
    );
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-surface-3 font-semibold uppercase text-fg-2 ring-1 ring-line" style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.36)) }} aria-hidden>
      {symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "?"}
    </span>
  );
}

/** Avatar for any engine symbol; an option shows its underlying with a small C / P mark. Never throws. */
export function TradeSymbolAvatar({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const p = parseSeries(symbol);
  if (!p) return <BaseAvatar symbol={symbol ?? ""} size={size} />;
  const badge = Math.max(10, Math.round(size * 0.5));
  return (
    <span className="relative inline-flex shrink-0">
      <BaseAvatar symbol={p.underlying} size={size} />
      <span
        aria-hidden
        className={cn("absolute -bottom-1 -end-1 grid place-items-center rounded-full font-bold leading-none text-white ring-2 ring-surface", p.right === "call" ? "bg-up" : "bg-down")}
        style={{ width: badge, height: badge, fontSize: Math.round(badge * 0.6) }}
      >
        {p.right === "call" ? "C" : "P"}
      </span>
    </span>
  );
}

/** "2 Oct" (with the year when it isn't this year), in the reader's language. */
export function expiryLabel(day: string, locale: string) {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" }).format(d);
}

/** "EURUSD 1.1000 Call · 2 Oct" */
export function optionLabel(t: T, o: OptionTerms) {
  return t("accounts.opt.label", { underlying: o.underlying, strike: o.strikeLabel, right: t(o.right === "call" ? "accounts.opt.call" : "accounts.opt.put"), date: expiryLabel(o.expiry, t.locale) });
}

/** Readable name of an engine symbol: the option label for a series code, the symbol itself otherwise. */
export function symbolLabel(t: T, symbol: string, option?: DealOption | PositionOption | null) {
  const o = option || parseSeries(symbol) ? optionTerms(symbol, option) : null;
  return o ? optionLabel(t, o) : symbol;
}

/** Drop-in for @ezymex/ui `SymbolCell` that takes any engine symbol (series codes read as "EURUSD 1.1000 Call · 2 Oct"). */
export function TradeSymbolCell({ symbol, size = 28, sub, className, option }: { symbol: string; size?: number; sub?: React.ReactNode; className?: string; option?: DealOption | PositionOption | null }) {
  const t = useT();
  const o = option || parseSeries(symbol) ? optionTerms(symbol, option) : null;
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <TradeSymbolAvatar symbol={o?.series ?? symbol} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-fg" title={o ? o.series : undefined}>
          {o ? optionLabel(t, o) : symbol}
        </span>
        <span className="block truncate text-[12px] text-fg-3">{sub ?? (o ? t("accounts.opt.tag") : (INSTRUMENT_MAP[symbol]?.name ?? ""))}</span>
      </span>
    </span>
  );
}

/** Small "Option" tag next to a trade's name. */
export function OptionTag({ className }: { className?: string }) {
  const t = useT();
  return <span className={cn("inline-flex h-[18px] items-center rounded-full border border-gold/30 bg-gold-soft px-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold", className)}>{t("accounts.opt.tag")}</span>;
}

/** Label of a deal's close reason (engine DealReason); options read "Closed" for a client close. */
export function reasonLabel(t: T, reason: string) {
  return t.dyn(`accounts.reason.${reason}`, reason.replace(/_/g, " "));
}

export const fmtContracts = (v: number) => Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2, useGrouping: false });

/** An option premium in USD per contract, or the per-unit price with its quote currency when it can't be converted
 *  (data without the option's cash / contract size). */
export function OptionPremium({ usd, unit, currency }: { usd: number | null; unit: number | null | undefined; currency?: string }) {
  const t = useT();
  if (usd !== null)
    return (
      <span className="whitespace-nowrap">
        {fmtAmount(usd, "$")}
        <span className="ms-1 font-sans text-[10.5px] text-fg-3">{t("accounts.opt.perContract")}</span>
      </span>
    );
  return (
    <span className="whitespace-nowrap">
      {fmtPrice(unit)}
      <span className="ms-1 font-sans text-[10.5px] text-fg-3">{currency ? t("accounts.opt.perUnit", { currency }) : t("accounts.opt.perUnitPlain")}</span>
    </span>
  );
}
