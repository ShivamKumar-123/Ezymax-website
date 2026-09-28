// Countries offered at sign-up (ISO code, name, dial code). Blocked jurisdictions are handled by the gateway later (D34).

export const COUNTRIES = [
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
] as const;

/** Latest date of birth for someone who is 18 today (YYYY-MM-DD). */
export function maxDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}
