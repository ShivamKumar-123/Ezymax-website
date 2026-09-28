const nf = new Map<string, Intl.NumberFormat>();
function fmt(min: number, max: number) {
  const k = `${min}-${max}`;
  if (!nf.has(k)) nf.set(k, new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max }));
  return nf.get(k)!;
}

export function formatNumber(v: number, decimals = 2) {
  return fmt(decimals, decimals).format(v);
}

/** Splits a number into integer and decimal parts for the "dimmed decimals" treatment. */
export function splitNumber(v: number, decimals = 2) {
  const s = formatNumber(Math.abs(v), decimals);
  const [int, dec] = s.split(".");
  return { sign: v < 0 ? "-" : "", int: int!, dec: dec ?? "" };
}

export function formatMoney(v: number, currency = "USD", decimals = 2) {
  const sym = currency === "USD" ? "$" : "";
  const sign = v < 0 ? "-" : "";
  return `${sign}${sym}${formatNumber(Math.abs(v), decimals)}${currency !== "USD" ? ` ${currency}` : ""}`;
}

export function formatCompact(v: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(v);
}

export function formatPct(v: number, decimals = 2, signed = true) {
  return `${signed && v > 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

/** Date/time in server time (GMT+3), e.g. "24 Sep, 21:40". */
export function formatDateTime(iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) {
  // en-GB prints "Sept" on newer ICU builds; normalise to the 3-letter form used across the UI.
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/Istanbul" }).format(new Date(iso)).replace("Sept", "Sep");
}

export function shortHash(h: string, head = 6, tail = 4) {
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
}

/** Splits a price so the final pip digits can be emphasised MT5-style. */
export function splitPrice(v: number, digits: number) {
  const s = formatNumber(v, digits);
  if (digits < 2) return { head: s, pips: "", tail: "" };
  const hasPipette = digits === 3 || digits === 5;
  const tail = hasPipette ? s.slice(-1) : "";
  const body = hasPipette ? s.slice(0, -1) : s;
  return { head: body.slice(0, -2), pips: body.slice(-2), tail };
}
