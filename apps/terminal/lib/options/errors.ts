// Engine / options-service rejections → what the client reads. The codes come from the engine's options API
// (services/trading) and the options service (services/options); unknown codes fall back to the server's message.
import { tr } from "@kalks/i18n/react";
import type { EngineErr } from "@/lib/engine/map";
import { CLIENT_AREA } from "@/lib/guest";
import type { Reason } from "./types";

export const OPTION_ERROR_CODES = [
  "options_disabled",
  "not_eligible",
  "market_closed",
  "cutoff",
  "closed",
  "series_halted",
  "close_only",
  "limit_contracts",
  "insufficient_cash",
  "insufficient_margin",
  "stale_prices",
  "no_price",
  "read_only",
  "unavailable",
  "session_expired",
] as const;

/** Where a client completes the options onboarding (KYC, risk disclosure, knowledge quiz). */
export const ONBOARDING_URL = `${CLIENT_AREA}/options`;

export function reasonCode(r: Reason): string {
  return typeof r === "string" ? r : (r.code ?? "");
}

/** Translated text of a rejection code (or the server's message when the code is unknown). */
export function optionErrorText(code: string, message?: string): string {
  if ((OPTION_ERROR_CODES as readonly string[]).includes(code)) return tr.dyn(`trader.opt.err.${code}`, message ?? code);
  return message || code.replace(/_/g, " ");
}

export function reasonText(r: Reason): string {
  return typeof r === "string" ? optionErrorText(r) : optionErrorText(r.code ?? "", r.message);
}

export function errText(e: EngineErr): string {
  return optionErrorText(e.code, e.message);
}

/** The rejection asks the client to finish the options onboarding in the Client Area. */
export const needsOnboarding = (code: string) => code === "not_eligible";
