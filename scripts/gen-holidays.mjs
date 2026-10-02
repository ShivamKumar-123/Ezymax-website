// Generates the per-currency bank-holiday calendars in config/holidays/<CODE>.json.
//
// WHY: these calendars decide FX option expiry dates. An expiry that lands on a holiday in either currency of the
// pair, or in USD / New York, is rolled back to the previous business day. A missing holiday means an expiry on a
// day the market is shut, so correctness matters more than breadth.
//
// HOW: every date is computed from rules (fixed dates, nth-weekday rules, Easter, substitute / "Mondayisation"
// rules). The only hard-coded dates are those set by decree rather than by a rule (Japan's equinox days, NZ
// Matariki, NSW's 2026/2027 Anzac Day additional days); each table cites its source. All arithmetic is on UTC
// day numbers (days since 1970-01-01), so the local time zone of the machine never matters. Only Monday-Friday
// closures are written (weekends are never business days), but substitute rules ARE applied, so a weekend
// holiday that moves to a weekday appears on that weekday as "<name> (substitute)". Output is deterministic:
// same script, same bytes.
//
// RULES (per calendar; the "rules" string in each JSON file repeats the summary):
//   USD  Federal Reserve / New York: Jan 1, MLK Day (3rd Mon Jan), Washington's Birthday (3rd Mon Feb), Memorial
//        Day (last Mon May), Juneteenth (Jun 19), Independence Day (Jul 4), Labor Day (1st Mon Sep), Columbus Day
//        (2nd Mon Oct), Veterans Day (Nov 11), Thanksgiving (4th Thu Nov), Christmas (Dec 25). Fed rule: a Sunday
//        holiday is observed Monday; a Saturday holiday is NOT moved (the Fed is open the Friday before).
//        Good Friday is not a USD holiday.
//   EUR  TARGET2 / T2: Jan 1, Good Friday, Easter Monday, May 1, Dec 25, Dec 26. No substitutes.
//   GBP  England & Wales: Jan 1, Good Friday, Easter Monday, Early May (1st Mon May), Spring (last Mon May),
//        Summer (last Mon Aug), Christmas, Boxing Day. Weekend Jan 1 / Dec 25 / Dec 26 move to the next weekday
//        that is not already a holiday (Xmas Sat -> Mon 27 + Boxing Tue 28; Xmas Sun -> Tue 27; Boxing Sat -> Mon 28).
//        No one-off (royal / jubilee) bank holidays are known for 2026-2028.
//   JPY  Tokyo: national holidays (Act on National Holidays) + bank holidays Jan 2, Jan 3, Dec 31 (Banking Act
//        Enforcement Order art. 5). Substitute holiday: a national holiday on Sunday -> the next day that is not a
//        national holiday. Citizens' holiday: a day sandwiched between two national holidays is a holiday.
//   CHF  Zurich / SIX SIC: Jan 1, Jan 2, Good Friday, Easter Monday, May 1, Ascension (Easter+39), Whit Monday
//        (Easter+50), Aug 1, Dec 25, Dec 26. No substitutes.
//   CAD  Toronto / Bank of Canada: Jan 1, Family Day (3rd Mon Feb), Good Friday, Victoria Day (Monday before
//        May 25), Canada Day (Jul 1), Civic Holiday (1st Mon Aug), Labour Day (1st Mon Sep), National Day for
//        Truth and Reconciliation (Sep 30), Thanksgiving (2nd Mon Oct), Remembrance Day (Nov 11), Christmas, Boxing
//        Day. Weekend Jan 1 / Jul 1 / Sep 30 / Nov 11 -> following Monday; Christmas / Boxing Day as GBP.
//   AUD  Sydney / NSW: Jan 1 and Australia Day (Jan 26) (weekend -> Monday), Good Friday, Easter Monday, Anzac
//        Day (Apr 25; no standing substitute in NSW, but the Mondays 2026-04-27 and 2027-04-26 were declared by
//        order - see AU_NSW_ANZAC_ADDITIONAL), King's Birthday (2nd Mon Jun), Bank Holiday (1st Mon Aug), Labour
//        Day (1st Mon Oct), Christmas, Boxing Day (as GBP).
//   NZD  Wellington + Auckland: Jan 1 and Jan 2 (Mondayised as a pair), Wellington Anniversary (Monday nearest
//        Jan 22), Auckland Anniversary (Monday nearest Jan 29), Waitangi Day (Feb 6) and ANZAC Day (Apr 25)
//        (weekend -> Monday), Good Friday, Easter Monday, King's Birthday (1st Mon Jun), Matariki (decree), Labour
//        Day (4th Mon Oct), Christmas, Boxing Day (as GBP). "Monday nearest": Tue-Thu -> previous Monday, Fri-Sun
//        -> following Monday.
//   XAU, XAG  London LBMA + New York: union of USD and GBP, names prefixed "US: " / "UK: " (joined with " / "
//        when both close on the same day).
//   OIL  NYMEX / ICE settlement: the USD calendar.
//   Easter Sunday: Anonymous Gregorian algorithm (Meeus / Jones / Butcher).
//
// SOURCES (checked Oct 2026; output cross-checked against the first five where they publish these years):
//   USD  Federal Reserve K.8 holidays observed  https://www.federalreserve.gov/aboutthefed/k8.htm (2026-2030)
//                                               https://www.frbservices.org/about/holiday-schedules
//   GBP  gov.uk bank holidays                   https://www.gov.uk/bank-holidays.json (2026-2028)
//   JPY  Cabinet Office Japan, national holidays https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv (to 2027)
//        NAOJ "Rekiyoko" (equinox days)         https://eco.mtk.nao.ac.jp/koyomi/yoko/
//   NZD  NZ Employment, public holidays and anniversary dates (2026-2027)
//        https://www.employment.govt.nz/leave-and-holidays/public-holidays/public-holidays-and-anniversary-dates
//        Te Kahui o Matariki Public Holiday Act 2022, Schedule 1 (Matariki dates)
//   AUD  NSW Government public / bank holidays  https://www.nsw.gov.au/about-nsw/public-holidays (2026-2027)
//        RBA public and bank holidays           https://www.rba.gov.au/schedules-events/bank-holidays-2026.html
//   CHF  SIX Interbank Clearing (SIC) clearing-day calendar / banking-holidays.pdf  https://www.six-group.com
//   CAD  Bank of Canada holiday schedule
//        https://www.bankofcanada.ca/about/contact-information/bank-of-canada-holiday-schedule/
//   EUR  ECB, TARGET2 / T2 closing days         https://www.ecb.europa.eu (Payments > TARGET services > T2)
//
// REVIEW YEARLY (each autumn, before the next year's option expiries are listed): compare the output with the
// sources above for new or one-off holidays (royal events, days of mourning, new statutory holidays, changed
// rules). When extending YEARS, add the decree dates for the new years (JP_EQUINOX, NZ_MATARIKI,
// AU_NSW_ANZAC_ADDITIONAL); the script refuses to run without them.
//
// USAGE
//   node scripts/gen-holidays.mjs           regenerate config/holidays/*.json and print a review table
//   node scripts/gen-holidays.mjs --check   regenerate in memory; exit 1 if the files on disk differ (for CI)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const YEARS = [2026, 2027, 2028];
const GENERATED_BY = "scripts/gen-holidays.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "config", "holidays");

// ---------------------------------------------------------------------------------------------------------------
// Decree dates (not rule-based). Every year in YEARS must be present.
// ---------------------------------------------------------------------------------------------------------------

// Japan: Vernal / Autumnal Equinox Day are the astronomical equinox dates (JST) as published by the National
// Astronomical Observatory of Japan in its "Rekiyoko" in the Official Gazette on the first business day of February
// of the previous year (2026: gazetted Feb 2025; 2027: gazetted Feb 2026; 2028: NAOJ calculation, gazetted Feb 2027 -
// re-confirm then).
const JP_EQUINOX = {
  2026: { vernal: "2026-03-20", autumnal: "2026-09-23" },
  2027: { vernal: "2027-03-21", autumnal: "2027-09-23" },
  2028: { vernal: "2028-03-20", autumnal: "2028-09-22" },
};

// New Zealand: Matariki public holiday dates are fixed in Schedule 1 of the Te Kahui o Matariki Public Holiday Act
// 2022 (dates set by the Matariki Advisory Group from the Maori lunar calendar).
const NZ_MATARIKI = {
  2026: "2026-07-10",
  2027: "2027-06-25",
  2028: "2028-07-14",
};

// Australia (NSW): the Public Holidays Act 2010 gives Anzac Day no standing weekend substitute. For 2026 (Sat) and
// 2027 (Sun) the NSW Government declared an additional public holiday on the following Monday, for the whole
// state, by order under s.5 of that Act (announced Feb 2026, a trial). Listed on nsw.gov.au/about-nsw/public-holidays
// ("Additional Day") and by the RBA (rba.gov.au/schedules-events/bank-holidays-2026.html: "27 April, Additional
// Day, ACT, NSW, WA"). null = no additional day that year (Apr 25 2028 is a Tuesday). Before adding a year in which
// Apr 25 falls on a weekend (next: 2032), check whether NSW has extended or legislated the trial.
const AU_NSW_ANZAC_ADDITIONAL = {
  2026: "2026-04-27",
  2027: "2027-04-26",
  2028: null,
};

function decree(table, year, what) {
  const value = table[year];
  if (value === undefined) {
    throw new Error(`${what}: no decree date for ${year}; add it to the table in ${GENERATED_BY}`);
  }
  return value;
}

// ---------------------------------------------------------------------------------------------------------------
// UTC day-number arithmetic. A date is an integer: days since 1970-01-01 (UTC). No local-time Date APIs are used.
// ---------------------------------------------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
const SUN = 0;
const MON = 1;
const TUE = 2;
const THU = 4;
const SAT = 6;

/** Day number of a calendar date (month 1-12). Out-of-range days roll over like Date.UTC (day 0 = last of prev month). */
function day(y, m, d) {
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function fromIso(s) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) throw new Error(`bad ISO date ${s}`);
  const n = day(Number(match[1]), Number(match[2]), Number(match[3]));
  if (iso(n) !== s) throw new Error(`invalid date ${s}`);
  return n;
}

/** 0 = Sunday ... 6 = Saturday. 1970-01-01 was a Thursday. */
function weekday(n) {
  return (((n + THU) % 7) + 7) % 7;
}

function isWeekend(n) {
  const w = weekday(n);
  return w === SAT || w === SUN;
}

function iso(n) {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The nth (1-based) given weekday of a month, e.g. nthWeekday(2026, 1, MON, 3) = 3rd Monday of January 2026. */
function nthWeekday(y, m, wd, nth) {
  const first = day(y, m, 1);
  const n = first + ((wd - weekday(first) + 7) % 7) + (nth - 1) * 7;
  if (new Date(n * MS_PER_DAY).getUTCMonth() !== m - 1) throw new Error(`no weekday #${nth} in ${y}-${m}`);
  return n;
}

/** The last given weekday of a month. */
function lastWeekday(y, m, wd) {
  const last = day(y, m + 1, 0);
  return last - ((weekday(last) - wd + 7) % 7);
}

/** The latest given weekday strictly before day n. */
function weekdayBefore(n, wd) {
  return n - ((weekday(n) - wd + 7) % 7 || 7);
}

/** The given weekday on or after day n. */
function weekdayOnOrAfter(n, wd) {
  return n + ((wd - weekday(n) + 7) % 7);
}

/** NZ anniversary rule: Monday stays; Tue-Thu -> previous Monday; Fri-Sun -> following Monday. */
function mondayNearest(n) {
  const w = weekday(n);
  if (w >= TUE && w <= THU) return n - (w - MON);
  return weekdayOnOrAfter(n, MON);
}

/** Easter Sunday, Anonymous Gregorian algorithm (Meeus, "Astronomical Algorithms", ch. 8). */
function easterSunday(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const dom = ((h + l - 7 * m + 114) % 31) + 1;
  return day(y, month, dom);
}

// ---------------------------------------------------------------------------------------------------------------
// Observance: turns a year's rule dates into the weekdays on which the market is closed.
//   "none"   weekday: listed; weekend: dropped.
//   "fed"    Sunday -> following Monday; Saturday -> dropped (Federal Reserve).
//   "monday" Saturday / Sunday -> following Monday ("Mondayisation").
//   "next"   Saturday / Sunday -> next weekday not already a holiday, in date order (UK-style substitute day;
//            resolves the Christmas / Boxing Day and Jan 1 / Jan 2 pairs).
// ---------------------------------------------------------------------------------------------------------------

const rule = (date, name, observe = "none") => ({ date, name, observe });
const substitute = (name) => `${name} (substitute)`;

function observe(rules) {
  const out = [];
  const taken = new Set();
  const add = (date, name) => {
    out.push({ date, name });
    taken.add(date);
  };
  for (const r of rules) {
    if (!["none", "fed", "monday", "next"].includes(r.observe)) throw new Error(`unknown observance ${r.observe}`);
    if (!isWeekend(r.date)) add(r.date, r.name);
    else if (r.observe === "fed" && weekday(r.date) === SUN) add(r.date + 1, substitute(r.name));
    else if (r.observe === "monday") add(weekdayOnOrAfter(r.date, MON), substitute(r.name));
  }
  const pending = rules.filter((r) => r.observe === "next" && isWeekend(r.date)).sort((a, b) => a.date - b.date);
  for (const r of pending) {
    let d = r.date + 1;
    while (isWeekend(d) || taken.has(d)) d += 1;
    add(d, substitute(r.name));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Calendars. Each `days(y)` returns the closures of year y as [{ date: dayNumber, name }].
// ---------------------------------------------------------------------------------------------------------------

function usd(y) {
  return observe([
    rule(day(y, 1, 1), "New Year's Day", "fed"),
    rule(nthWeekday(y, 1, MON, 3), "Martin Luther King Jr. Day"),
    rule(nthWeekday(y, 2, MON, 3), "Washington's Birthday (Presidents Day)"),
    rule(lastWeekday(y, 5, MON), "Memorial Day"),
    rule(day(y, 6, 19), "Juneteenth National Independence Day", "fed"),
    rule(day(y, 7, 4), "Independence Day", "fed"),
    rule(nthWeekday(y, 9, MON, 1), "Labor Day"),
    rule(nthWeekday(y, 10, MON, 2), "Columbus Day"),
    rule(day(y, 11, 11), "Veterans Day", "fed"),
    rule(nthWeekday(y, 11, THU, 4), "Thanksgiving Day"),
    rule(day(y, 12, 25), "Christmas Day", "fed"),
  ]);
}

function eur(y) {
  const easter = easterSunday(y);
  return observe([
    rule(day(y, 1, 1), "New Year's Day"),
    rule(easter - 2, "Good Friday"),
    rule(easter + 1, "Easter Monday"),
    rule(day(y, 5, 1), "Labour Day"),
    rule(day(y, 12, 25), "Christmas Day"),
    rule(day(y, 12, 26), "Christmas Holiday (Dec 26)"),
  ]);
}

function gbp(y) {
  const easter = easterSunday(y);
  return observe([
    rule(day(y, 1, 1), "New Year's Day", "next"),
    rule(easter - 2, "Good Friday"),
    rule(easter + 1, "Easter Monday"),
    rule(nthWeekday(y, 5, MON, 1), "Early May bank holiday"),
    rule(lastWeekday(y, 5, MON), "Spring bank holiday"),
    rule(lastWeekday(y, 8, MON), "Summer bank holiday"),
    rule(day(y, 12, 25), "Christmas Day", "next"),
    rule(day(y, 12, 26), "Boxing Day", "next"),
  ]);
}

function jpy(y) {
  const equinox = decree(JP_EQUINOX, y, "Japan equinox days");
  // "Kokumin no shukujitsu" (national holidays proper), Act on National Holidays art. 2.
  const national = [
    rule(day(y, 1, 1), "New Year's Day"),
    rule(nthWeekday(y, 1, MON, 2), "Coming of Age Day"),
    rule(day(y, 2, 11), "National Foundation Day"),
    rule(day(y, 2, 23), "Emperor's Birthday"),
    rule(fromIso(equinox.vernal), "Vernal Equinox Day"),
    rule(day(y, 4, 29), "Showa Day"),
    rule(day(y, 5, 3), "Constitution Memorial Day"),
    rule(day(y, 5, 4), "Greenery Day"),
    rule(day(y, 5, 5), "Children's Day"),
    rule(nthWeekday(y, 7, MON, 3), "Marine Day"),
    rule(day(y, 8, 11), "Mountain Day"),
    rule(nthWeekday(y, 9, MON, 3), "Respect for the Aged Day"),
    rule(fromIso(equinox.autumnal), "Autumnal Equinox Day"),
    rule(nthWeekday(y, 10, MON, 2), "Sports Day"),
    rule(day(y, 11, 3), "Culture Day"),
    rule(day(y, 11, 23), "Labour Thanksgiving Day"),
  ];
  const isNational = new Set(national.map((r) => r.date));
  const out = [...national];
  // Art. 3(2): a national holiday on Sunday -> the nearest following day that is not a national holiday.
  for (const r of national) {
    if (weekday(r.date) !== SUN) continue;
    let d = r.date + 1;
    while (isNational.has(d)) d += 1;
    out.push(rule(d, substitute(r.name)));
  }
  // Art. 3(3): a day whose previous and next days are both national holidays (and is not one itself).
  for (let d = day(y, 1, 1); d <= day(y, 12, 31); d += 1) {
    if (!isNational.has(d) && isNational.has(d - 1) && isNational.has(d + 1)) out.push(rule(d, "Citizens' Holiday"));
  }
  // Banks are also closed Dec 31 - Jan 3 (Banking Act Enforcement Order art. 5); no substitutes for these.
  out.push(rule(day(y, 1, 2), "Bank Holiday (New Year)"));
  out.push(rule(day(y, 1, 3), "Bank Holiday (New Year)"));
  out.push(rule(day(y, 12, 31), "Bank Holiday (Year End)"));
  return out.filter((r) => !isWeekend(r.date)).map(({ date, name }) => ({ date, name }));
}

function chf(y) {
  const easter = easterSunday(y);
  return observe([
    rule(day(y, 1, 1), "New Year's Day"),
    rule(day(y, 1, 2), "Berchtold's Day"),
    rule(easter - 2, "Good Friday"),
    rule(easter + 1, "Easter Monday"),
    rule(day(y, 5, 1), "Labour Day"),
    rule(easter + 39, "Ascension Day"),
    rule(easter + 50, "Whit Monday"),
    rule(day(y, 8, 1), "Swiss National Day"),
    rule(day(y, 12, 25), "Christmas Day"),
    rule(day(y, 12, 26), "St. Stephen's Day"),
  ]);
}

function cad(y) {
  const easter = easterSunday(y);
  return observe([
    rule(day(y, 1, 1), "New Year's Day", "monday"),
    rule(nthWeekday(y, 2, MON, 3), "Family Day"),
    rule(easter - 2, "Good Friday"),
    rule(weekdayBefore(day(y, 5, 25), MON), "Victoria Day"),
    rule(day(y, 7, 1), "Canada Day", "monday"),
    rule(nthWeekday(y, 8, MON, 1), "Civic Holiday"),
    rule(nthWeekday(y, 9, MON, 1), "Labour Day"),
    rule(day(y, 9, 30), "National Day for Truth and Reconciliation", "monday"),
    rule(nthWeekday(y, 10, MON, 2), "Thanksgiving Day"),
    rule(day(y, 11, 11), "Remembrance Day", "monday"),
    rule(day(y, 12, 25), "Christmas Day", "next"),
    rule(day(y, 12, 26), "Boxing Day", "next"),
  ]);
}

function aud(y) {
  const easter = easterSunday(y);
  const anzacAdditional = decree(AU_NSW_ANZAC_ADDITIONAL, y, "NSW Anzac Day additional day");
  return observe([
    rule(day(y, 1, 1), "New Year's Day", "monday"),
    rule(day(y, 1, 26), "Australia Day", "monday"),
    rule(easter - 2, "Good Friday"),
    rule(easter + 1, "Easter Monday"),
    rule(day(y, 4, 25), "Anzac Day"), // NSW: no standing substitute when Anzac Day falls on a weekend ...
    ...(anzacAdditional ? [rule(fromIso(anzacAdditional), "Anzac Day (additional day)")] : []), // ... except by order
    rule(nthWeekday(y, 6, MON, 2), "King's Birthday"),
    rule(nthWeekday(y, 8, MON, 1), "Bank Holiday"),
    rule(nthWeekday(y, 10, MON, 1), "Labour Day"),
    rule(day(y, 12, 25), "Christmas Day", "next"),
    rule(day(y, 12, 26), "Boxing Day", "next"),
  ]);
}

function nzd(y) {
  const easter = easterSunday(y);
  return observe([
    rule(day(y, 1, 1), "New Year's Day", "next"),
    rule(day(y, 1, 2), "Day after New Year's Day", "next"),
    rule(mondayNearest(day(y, 1, 22)), "Wellington Anniversary Day"),
    rule(mondayNearest(day(y, 1, 29)), "Auckland Anniversary Day"),
    rule(day(y, 2, 6), "Waitangi Day", "monday"),
    rule(easter - 2, "Good Friday"),
    rule(easter + 1, "Easter Monday"),
    rule(day(y, 4, 25), "ANZAC Day", "monday"),
    rule(nthWeekday(y, 6, MON, 1), "King's Birthday"),
    rule(fromIso(decree(NZ_MATARIKI, y, "NZ Matariki")), "Matariki"),
    rule(nthWeekday(y, 10, MON, 4), "Labour Day"),
    rule(day(y, 12, 25), "Christmas Day", "next"),
    rule(day(y, 12, 26), "Boxing Day", "next"),
  ]);
}

/** London LBMA + New York: union of USD and GBP with "US: " / "UK: " prefixes. */
function usdGbpUnion(y) {
  return [
    ...usd(y).map((h) => ({ date: h.date, name: `US: ${h.name}` })),
    ...gbp(y).map((h) => ({ date: h.date, name: `UK: ${h.name}` })),
  ];
}

const USD_RULES =
  "Federal Reserve (Fedwire) holidays: New Year's Day (Jan 1), Martin Luther King Jr. Day (3rd Mon Jan), " +
  "Washington's Birthday (3rd Mon Feb), Memorial Day (last Mon May), Juneteenth (Jun 19), Independence Day (Jul 4), " +
  "Labor Day (1st Mon Sep), Columbus Day (2nd Mon Oct), Veterans Day (Nov 11), Thanksgiving (4th Thu Nov), " +
  "Christmas Day (Dec 25). A Sunday holiday is observed the following Monday; a Saturday holiday is not moved " +
  "(the Fed is open the Friday before). Good Friday is not a holiday.";

const CALENDARS = [
  {
    code: "USD",
    description: "US Federal Reserve / New York bank holidays",
    rules: USD_RULES,
    days: usd,
  },
  {
    code: "EUR",
    description: "Euro area TARGET2 (T2) closing days",
    rules:
      "TARGET2 / T2 closing days: New Year's Day, Good Friday, Easter Monday, Labour Day (May 1), Christmas Day, " +
      "Dec 26. Easter by the Anonymous Gregorian (Meeus) algorithm. No substitute days.",
    days: eur,
  },
  {
    code: "GBP",
    description: "UK (London, England & Wales) bank holidays",
    rules:
      "England & Wales bank holidays: New Year's Day, Good Friday, Easter Monday, Early May bank holiday " +
      "(1st Mon May), Spring bank holiday (last Mon May), Summer bank holiday (last Mon Aug), Christmas Day, " +
      "Boxing Day. A weekend New Year's Day, Christmas Day or Boxing Day moves to the next weekday that is not " +
      "already a holiday (Christmas Sat: Mon 27 + Tue 28; Christmas Sun: Tue 27; Boxing Day Sat: Mon 28). " +
      "No one-off bank holidays for 2026-2028.",
    days: gbp,
  },
  {
    code: "JPY",
    description: "Japan (Tokyo) national holidays and bank holidays",
    rules:
      "Act on National Holidays: New Year's Day, Coming of Age Day (2nd Mon Jan), National Foundation Day " +
      "(Feb 11), Emperor's Birthday (Feb 23), Vernal Equinox Day (NAOJ decree), Showa Day (Apr 29), Constitution " +
      "Memorial Day (May 3), Greenery Day (May 4), Children's Day (May 5), Marine Day (3rd Mon Jul), Mountain Day " +
      "(Aug 11), Respect for the Aged Day (3rd Mon Sep), Autumnal Equinox Day (NAOJ decree), Sports Day (2nd Mon " +
      "Oct), Culture Day (Nov 3), Labour Thanksgiving Day (Nov 23). A national holiday on Sunday gives a substitute " +
      "on the next day that is not a national holiday; a day between two national holidays is a Citizens' Holiday. " +
      "Bank holidays Jan 2, Jan 3 and Dec 31 (no substitutes).",
    days: jpy,
  },
  {
    code: "CHF",
    description: "Switzerland (Zurich / SIX SIC) settlement holidays",
    rules:
      "SIC / Zurich: New Year's Day, Berchtold's Day (Jan 2), Good Friday, Easter Monday, Labour Day (May 1), " +
      "Ascension Day (Easter + 39), Whit Monday (Easter + 50), Swiss National Day (Aug 1), Christmas Day, " +
      "St. Stephen's Day (Dec 26). No substitute days.",
    days: chf,
  },
  {
    code: "CAD",
    description: "Canada (Toronto / Bank of Canada) bank holidays",
    rules:
      "New Year's Day, Family Day (3rd Mon Feb, Ontario), Good Friday, Victoria Day (last Mon before May 25), " +
      "Canada Day (Jul 1), Civic Holiday (1st Mon Aug), Labour Day (1st Mon Sep), National Day for Truth and " +
      "Reconciliation (Sep 30), Thanksgiving (2nd Mon Oct), Remembrance Day (Nov 11), Christmas Day, Boxing Day. " +
      "Weekend New Year's Day, Canada Day, Sep 30 or Nov 11 move to the following Monday; Christmas Day and " +
      "Boxing Day move to the next weekday not already a holiday.",
    days: cad,
  },
  {
    code: "AUD",
    description: "Australia (Sydney, NSW) bank holidays",
    rules:
      "NSW: New Year's Day and Australia Day (Jan 26) (weekend: following Monday), Good Friday, Easter Monday, " +
      "Anzac Day (Apr 25; no standing weekend substitute, but additional days 2026-04-27 and 2027-04-26 declared " +
      "by NSW order under the Public Holidays Act 2010), King's Birthday (2nd Mon Jun), Bank Holiday " +
      "(1st Mon Aug), Labour Day (1st Mon Oct), Christmas Day, Boxing Day (weekend: next weekday not already a " +
      "holiday).",
    days: aud,
  },
  {
    code: "NZD",
    description: "New Zealand (Wellington + Auckland) bank holidays",
    rules:
      "New Year's Day and Day after New Year's Day (Jan 2) (weekend: next weekdays not already holidays), " +
      "Wellington Anniversary (Monday nearest Jan 22), Auckland Anniversary (Monday nearest Jan 29), Waitangi Day " +
      "(Feb 6) and ANZAC Day (Apr 25) (weekend: following Monday), Good Friday, Easter Monday, King's Birthday " +
      "(1st Mon Jun), Matariki (Te Kahui o Matariki Public Holiday Act 2022 dates), Labour Day (4th Mon Oct), " +
      "Christmas Day, Boxing Day (weekend: next weekday not already a holiday). Monday nearest: Tue-Thu use the " +
      "previous Monday, Fri-Sun the following Monday.",
    days: nzd,
  },
  {
    code: "XAU",
    description: "Gold (London LBMA + New York): union of the USD and GBP calendars",
    rules:
      "Union of the USD (Federal Reserve) and GBP (England & Wales) calendars; names prefixed 'US: ' / 'UK: ', " +
      "joined with ' / ' when both close on the same day.",
    days: usdGbpUnion,
  },
  {
    code: "XAG",
    description: "Silver (London LBMA + New York): union of the USD and GBP calendars",
    rules:
      "Union of the USD (Federal Reserve) and GBP (England & Wales) calendars; names prefixed 'US: ' / 'UK: ', " +
      "joined with ' / ' when both close on the same day.",
    days: usdGbpUnion,
  },
  {
    code: "OIL",
    description: "Energies (NYMEX/ICE settlement): USD calendar",
    rules: `Same as the USD calendar. ${USD_RULES}`,
    days: usd,
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Build, validate, render.
// ---------------------------------------------------------------------------------------------------------------

/** Merge same-date entries (names joined with " / "), sort, convert to ISO, and check every invariant. */
function build(cal) {
  const byDate = new Map();
  for (const y of YEARS) {
    for (const h of cal.days(y)) {
      if (!Number.isInteger(h.date) || typeof h.name !== "string" || h.name === "") {
        throw new Error(`${cal.code}: malformed entry ${JSON.stringify(h)}`);
      }
      if (new Date(h.date * MS_PER_DAY).getUTCFullYear() !== y) {
        throw new Error(`${cal.code}: ${h.name} of ${y} observed on ${iso(h.date)}, outside its year`);
      }
      if (isWeekend(h.date)) throw new Error(`${cal.code}: ${iso(h.date)} (${h.name}) is a weekend`);
      const names = byDate.get(h.date) ?? [];
      if (!names.includes(h.name)) names.push(h.name);
      byDate.set(h.date, names);
    }
  }
  return [...byDate.keys()]
    .sort((a, b) => a - b)
    .map((d) => ({ date: iso(d), name: byDate.get(d).join(" / ") }));
}

function render(cal, holidays) {
  const lines = [
    "{",
    `  "calendar": ${JSON.stringify(cal.code)},`,
    `  "description": ${JSON.stringify(cal.description)},`,
    `  "rules": ${JSON.stringify(cal.rules)},`,
    `  "generatedBy": ${JSON.stringify(GENERATED_BY)},`,
    `  "years": [${YEARS.join(", ")}],`,
  ];
  if (holidays.length === 0) {
    lines.push(`  "holidays": []`);
  } else {
    lines.push(`  "holidays": [`);
    holidays.forEach((h, i) => {
      const comma = i < holidays.length - 1 ? "," : "";
      lines.push(`    { "date": ${JSON.stringify(h.date)}, "name": ${JSON.stringify(h.name)} }${comma}`);
    });
    lines.push("  ]");
  }
  lines.push("}");
  const text = `${lines.join("\n")}\n`;

  // The hand-rolled layout must round-trip to exactly the intended object.
  const expected = {
    calendar: cal.code,
    description: cal.description,
    rules: cal.rules,
    generatedBy: GENERATED_BY,
    years: YEARS,
    holidays,
  };
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(expected)) throw new Error(`${cal.code}: render mismatch`);
  return text;
}

function selfTest() {
  // Easter: known dates incl. the earliest (Mar 22, 2285) and latest (Apr 25, 2038) possible.
  const easter = {
    2000: "2000-04-23",
    2008: "2008-03-23",
    2011: "2011-04-24",
    2019: "2019-04-21",
    2024: "2024-03-31",
    2025: "2025-04-20",
    2026: "2026-04-05",
    2027: "2027-03-28",
    2028: "2028-04-16",
    2038: "2038-04-25",
    2285: "2285-03-22",
  };
  for (const [y, want] of Object.entries(easter)) {
    const got = iso(easterSunday(Number(y)));
    if (got !== want) throw new Error(`Easter ${y}: got ${got}, want ${want}`);
  }
  if (weekday(day(2026, 10, 2)) !== 5) throw new Error("weekday(): 2026-10-02 must be a Friday");
  if (weekday(day(1969, 12, 28)) !== SUN) throw new Error("weekday(): negative day numbers");
}

function printTable(results) {
  const span = `${YEARS[0]}-${YEARS[YEARS.length - 1]}`;
  const out = [`Bank-holiday calendars ${span} (Mon-Fri closures, MM-DD)`];
  for (const { cal, holidays } of results) {
    out.push("", `${cal.code.padEnd(4)}${cal.description}`);
    for (const y of YEARS) {
      const dates = holidays.filter((h) => h.date.startsWith(`${y}-`)).map((h) => h.date.slice(5));
      out.push(`  ${y} (${String(dates.length).padStart(2)})  ${dates.join(" ")}`);
    }
  }
  out.push("", `cal  ${YEARS.map(String).join(" ")}  total`);
  for (const { cal, holidays } of results) {
    const counts = YEARS.map((y) => String(holidays.filter((h) => h.date.startsWith(`${y}-`)).length).padStart(4));
    out.push(`${cal.code.padEnd(4)} ${counts.join(" ")}  ${String(holidays.length).padStart(5)}`);
  }
  console.log(out.join("\n"));
}

function main(argv) {
  const args = new Set(argv);
  for (const a of args) {
    if (a !== "--check") {
      console.error(`unknown argument ${a}\nusage: node ${GENERATED_BY} [--check]`);
      process.exit(2);
    }
  }
  const check = args.has("--check");

  selfTest();
  const results = CALENDARS.map((cal) => {
    const holidays = build(cal);
    return { cal, holidays, text: render(cal, holidays), file: join(OUT_DIR, `${cal.code}.json`) };
  });

  if (check) {
    const stale = results.filter((r) => !existsSync(r.file) || readFileSync(r.file, "utf8") !== r.text);
    for (const r of stale) console.error(`out of date: config/holidays/${r.cal.code}.json`);
    if (stale.length > 0) {
      console.error(`run: node ${GENERATED_BY}`);
      process.exit(1);
    }
    console.log(`config/holidays: ${results.length} calendars up to date`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const r of results) writeFileSync(r.file, r.text);
  printTable(results);
  console.log(`\nwrote ${results.length} files to config/holidays/`);
}

main(process.argv.slice(2));
