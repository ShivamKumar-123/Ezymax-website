// Wallet amounts are decimal strings end to end (the wallet service never uses floats). These helpers format them
// for display and keep amount fields clean; comparisons use integer cents, never float maths on money.
import { fmtMoney } from "@/lib/format";

/** "1234.5" -> "1,234.50"; keeps up to 6 significant decimals of the source string ("0.000125" stays exact). */
export function fmtAmount(v: string | number | null | undefined, dp = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  const frac = (String(v).split(".")[1] ?? "").replace(/0+$/, "").length;
  return fmtMoney(n, { decimals: Math.max(dp, Math.min(6, frac)) });
}

/** Amount field input: a comma becomes the decimal point, anything else that isn't a digit is dropped, one point,
 *  at most `maxDp` decimals, no leading zeros ("007" -> "7", "0.5" stays). */
export function cleanAmount(raw: string, maxDp = 2): string {
  let v = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, maxDp);
  if (v.startsWith(".")) v = `0${v}`;
  v = v.replace(/^0+(?=\d)/, "");
  return v.slice(0, 16);
}

/** A positive amount with at most `maxDp` decimals (the BFF's rule: 12 integer digits). */
export function isAmount(s: string, maxDp = 2): boolean {
  const re = new RegExp(`^\\d{1,12}(\\.\\d{1,${maxDp}})?$`);
  return re.test(s.trim()) && Number(s) > 0;
}

/** Integer cents of a decimal string or number (extra decimals are dropped, never rounded up). */
export function cents(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const s = typeof v === "number" ? (Number.isFinite(v) ? v.toFixed(6) : "0") : v.trim();
  const m = /^(-)?(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return 0;
  const c = Number(m[2]) * 100 + Number((m[3] ?? "").slice(0, 2).padEnd(2, "0"));
  return m[1] ? -c : c;
}

/** A cents value back to a plain decimal string for an amount field ("123456" -> "1234.56", "100" -> "1"). */
export function fromCents(c: number): string {
  const n = Math.max(0, Math.floor(c));
  const int = Math.floor(n / 100);
  const frac = String(n % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${int}.${frac}` : String(int);
}
