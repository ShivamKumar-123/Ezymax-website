// Countries offered at sign-up (ISO code, name, dial code): the same list as the Client Area (apps/crm/lib/countries.ts).
// Blocked jurisdictions are decided by the gateway.
export const COUNTRIES: readonly (readonly [string, string, string])[] = [
  ["in", "India", "+91"],
  ["ae", "United Arab Emirates", "+971"],
  ["sa", "Saudi Arabia", "+966"],
  ["qa", "Qatar", "+974"],
  ["kw", "Kuwait", "+965"],
  ["om", "Oman", "+968"],
  ["bh", "Bahrain", "+973"],
  ["eg", "Egypt", "+20"],
  ["tr", "Turkey", "+90"],
  ["vn", "Vietnam", "+84"],
  ["my", "Malaysia", "+60"],
  ["id", "Indonesia", "+62"],
  ["th", "Thailand", "+66"],
  ["ph", "Philippines", "+63"],
  ["sg", "Singapore", "+65"],
  ["bd", "Bangladesh", "+880"],
  ["lk", "Sri Lanka", "+94"],
  ["np", "Nepal", "+977"],
  ["ng", "Nigeria", "+234"],
  ["ke", "Kenya", "+254"],
  ["za", "South Africa", "+27"],
  ["br", "Brazil", "+55"],
  ["mx", "Mexico", "+52"],
  ["gb", "United Kingdom", "+44"],
];

/** Latest date of birth for someone who is 18 today (YYYY-MM-DD). */
export function maxDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

/** "19900131" -> "1990-01-31" while typing. */
export function maskDob(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}
