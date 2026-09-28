/**
 * Economic calendar for the current week (server time GMT+3).
 * Today is Thursday 24 Sep 2026; events earlier this week (and earlier today) carry actuals.
 */

export interface WeekEvent {
  id: string;
  day: number; // 0 = Mon … 4 = Fri
  time: string; // HH:mm GMT+3
  country: string; // flag-icons code
  currency: string;
  title: string;
  impact: 1 | 2 | 3;
  actual?: string;
  forecast: string;
  previous: string;
  /** Whether a higher print is good for the currency */
  better: "higher" | "lower" | "neutral";
  /** Last 8 releases, oldest first (numeric) */
  history: number[];
  unit: string;
  symbols: string[];
  about: string;
}

export const WEEK_DAYS = [
  { day: 0, label: "Mon", date: "21 Sep" },
  { day: 1, label: "Tue", date: "22 Sep" },
  { day: 2, label: "Wed", date: "23 Sep" },
  { day: 3, label: "Thu", date: "24 Sep" },
  { day: 4, label: "Fri", date: "25 Sep" },
];
export const TODAY_INDEX = 3;

export const CAL_COUNTRIES = [
  { code: "us", name: "United States", currency: "USD" },
  { code: "eu", name: "Euro Area", currency: "EUR" },
  { code: "gb", name: "United Kingdom", currency: "GBP" },
  { code: "jp", name: "Japan", currency: "JPY" },
  { code: "de", name: "Germany", currency: "EUR" },
  { code: "au", name: "Australia", currency: "AUD" },
  { code: "ca", name: "Canada", currency: "CAD" },
  { code: "cn", name: "China", currency: "CNY" },
  { code: "ch", name: "Switzerland", currency: "CHF" },
  { code: "nz", name: "New Zealand", currency: "NZD" },
];

type E = Omit<WeekEvent, "id">;
const ev: E[] = [
  // Monday
  { day: 0, time: "04:30", country: "cn", currency: "CNY", title: "PBoC Loan Prime Rate 1Y", impact: 2, actual: "3.35%", forecast: "3.35%", previous: "3.35%", better: "neutral", history: [3.65, 3.55, 3.45, 3.45, 3.45, 3.35, 3.35, 3.35], unit: "%", symbols: ["AUDUSD", "USDJPY"], about: "Benchmark lending rate set by the People's Bank of China. Changes ripple into AUD and Asian risk sentiment." },
  { day: 0, time: "10:30", country: "de", currency: "EUR", title: "HCOB Manufacturing PMI (Flash)", impact: 2, actual: "40.3", forecast: "42.3", previous: "42.4", better: "higher", history: [42.5, 45.4, 43.5, 45.4, 43.2, 42.4, 43.1, 42.4], unit: "", symbols: ["EURUSD", "GER40"], about: "Survey of German purchasing managers. Readings under 50 signal contraction in the manufacturing sector." },
  { day: 0, time: "11:00", country: "eu", currency: "EUR", title: "HCOB Composite PMI (Flash)", impact: 3, actual: "48.9", forecast: "50.5", previous: "51.0", better: "higher", history: [47.6, 49.2, 50.3, 51.7, 52.2, 50.9, 50.2, 51.0], unit: "", symbols: ["EURUSD", "GER40", "EURJPY"], about: "Blended manufacturing and services activity across the euro area; a leading indicator for ECB policy." },
  { day: 0, time: "11:30", country: "gb", currency: "GBP", title: "S&P Global Services PMI (Flash)", impact: 2, actual: "52.8", forecast: "53.5", previous: "53.7", better: "higher", history: [53.1, 52.9, 55.0, 52.9, 52.1, 52.5, 53.7, 53.7], unit: "", symbols: ["GBPUSD", "UK100"], about: "Activity in the UK services sector, which makes up about 80% of the economy." },
  { day: 0, time: "16:45", country: "us", currency: "USD", title: "S&P Global Manufacturing PMI", impact: 2, actual: "47.0", forecast: "48.5", previous: "47.9", better: "higher", history: [50.7, 51.9, 50.0, 51.3, 51.6, 49.6, 47.9, 47.9], unit: "", symbols: ["EURUSD", "US30", "XAUUSD"], about: "Flash reading of US factory activity from S&P Global's survey of purchasing managers." },
  { day: 0, time: "17:00", country: "us", currency: "USD", title: "FOMC Member Bostic Speaks", impact: 1, forecast: "—", previous: "—", better: "neutral", history: [], unit: "", symbols: ["EURUSD", "XAUUSD"], about: "Atlanta Fed President speaks on the economic outlook; markets watch for hints about the pace of cuts." },
  // Tuesday
  { day: 1, time: "03:30", country: "au", currency: "AUD", title: "RBA Interest Rate Decision", impact: 3, actual: "4.35%", forecast: "4.35%", previous: "4.35%", better: "higher", history: [4.1, 4.35, 4.35, 4.35, 4.35, 4.35, 4.35, 4.35], unit: "%", symbols: ["AUDUSD"], about: "The Reserve Bank of Australia sets the cash rate. The statement's tone on inflation drives AUD." },
  { day: 1, time: "09:30", country: "ch", currency: "CHF", title: "Trade Balance", impact: 1, actual: "4.10B", forecast: "3.65B", previous: "3.44B", better: "higher", history: [3.2, 4.1, 3.9, 5.1, 4.6, 3.8, 3.44, 3.44], unit: "B", symbols: ["USDCHF"], about: "Difference between the value of imported and exported goods." },
  { day: 1, time: "11:00", country: "de", currency: "EUR", title: "Ifo Business Climate", impact: 2, actual: "85.4", forecast: "86.0", previous: "86.6", better: "higher", history: [85.2, 87.3, 89.3, 89.0, 88.6, 87.0, 86.6, 86.6], unit: "", symbols: ["EURUSD", "GER40"], about: "Survey of around 9,000 German businesses rating current conditions and expectations." },
  { day: 1, time: "17:00", country: "us", currency: "USD", title: "CB Consumer Confidence", impact: 3, actual: "98.7", forecast: "103.9", previous: "105.6", better: "higher", history: [110.9, 104.8, 97.5, 102.0, 101.3, 100.3, 105.6, 105.6], unit: "", symbols: ["EURUSD", "US30", "NAS100"], about: "Conference Board survey of 5,000 households; a leading indicator of consumer spending." },
  { day: 1, time: "17:00", country: "us", currency: "USD", title: "Richmond Manufacturing Index", impact: 1, actual: "-21", forecast: "-12", previous: "-19", better: "higher", history: [-5, -7, 0, -10, -17, -17, -19, -19], unit: "", symbols: ["US30"], about: "Regional survey of manufacturers in the Richmond Fed district." },
  { day: 1, time: "21:00", country: "us", currency: "USD", title: "Fed Governor Bowman Speaks", impact: 2, forecast: "—", previous: "—", better: "neutral", history: [], unit: "", symbols: ["EURUSD", "XAUUSD", "USDJPY"], about: "Remarks from a voting FOMC member; hawkish comments typically support the dollar." },
  // Wednesday
  { day: 2, time: "04:30", country: "au", currency: "AUD", title: "Monthly CPI Indicator y/y", impact: 3, actual: "2.7%", forecast: "2.8%", previous: "3.5%", better: "higher", history: [3.4, 3.6, 3.6, 4.0, 4.0, 3.8, 3.5, 3.5], unit: "%", symbols: ["AUDUSD"], about: "Monthly measure of Australian consumer inflation; a key input for the RBA." },
  { day: 2, time: "10:00", country: "ch", currency: "CHF", title: "ZEW Economic Expectations", impact: 1, actual: "-3.2", forecast: "2.0", previous: "-0.2", better: "higher", history: [17.5, 22.2, 18.2, 17.1, 0.0, -0.2, -0.2, -0.2], unit: "", symbols: ["USDCHF"], about: "Survey of institutional investors and analysts on the Swiss 6-month outlook." },
  { day: 2, time: "17:00", country: "us", currency: "USD", title: "New Home Sales", impact: 2, actual: "716K", forecast: "700K", previous: "751K", better: "higher", history: [662, 683, 634, 621, 617, 668, 751, 751], unit: "K", symbols: ["US30", "SPX500"], about: "Annualised number of newly built single-family homes sold during the month." },
  { day: 2, time: "17:30", country: "us", currency: "USD", title: "Crude Oil Inventories", impact: 2, actual: "-4.5M", forecast: "-1.4M", previous: "-1.6M", better: "lower", history: [1.4, -4.9, -3.4, -3.7, -3.4, 0.8, -1.6, -1.6], unit: "M", symbols: ["USOIL", "UKOIL", "USDCAD"], about: "Weekly change in US commercial crude stocks from the EIA. A larger draw is bullish for oil." },
  { day: 2, time: "20:00", country: "us", currency: "USD", title: "5-Year Note Auction", impact: 1, actual: "3.52%", forecast: "—", previous: "3.71%", better: "neutral", history: [4.12, 4.33, 4.53, 4.23, 4.05, 3.71, 3.71, 3.52], unit: "%", symbols: ["USDJPY"], about: "Average yield on 5-year Treasury notes sold at auction." },
  // Thursday (today)
  { day: 3, time: "02:50", country: "jp", currency: "JPY", title: "Monetary Policy Meeting Minutes", impact: 2, actual: "—", forecast: "—", previous: "—", better: "neutral", history: [], unit: "", symbols: ["USDJPY", "JP225", "EURJPY"], about: "Detailed record of the BoJ's policy meeting; offers insight into the board's view on further hikes." },
  { day: 3, time: "10:30", country: "ch", currency: "CHF", title: "SNB Interest Rate Decision", impact: 3, actual: "1.00%", forecast: "1.00%", previous: "1.25%", better: "higher", history: [1.75, 1.75, 1.5, 1.5, 1.25, 1.25, 1.25, 1.0], unit: "%", symbols: ["USDCHF", "EURUSD"], about: "The Swiss National Bank cut rates for the third time this year to lean against franc strength." },
  { day: 3, time: "11:00", country: "de", currency: "EUR", title: "GfK Consumer Climate", impact: 1, actual: "-21.2", forecast: "-22.0", previous: "-22.0", better: "higher", history: [-27.3, -24.0, -20.9, -21.8, -21.6, -18.6, -22.0, -22.0], unit: "", symbols: ["EURUSD"], about: "Forward-looking gauge of German consumer sentiment." },
  { day: 3, time: "11:00", country: "eu", currency: "EUR", title: "ECB President Lagarde Speaks", impact: 3, actual: "—", forecast: "—", previous: "—", better: "neutral", history: [], unit: "", symbols: ["EURUSD", "GER40", "EURJPY"], about: "Lagarde testified before the European Parliament; she flagged downside risks to growth." },
  { day: 3, time: "15:30", country: "us", currency: "USD", title: "GDP q/q (Final)", impact: 3, actual: "3.0%", forecast: "3.0%", previous: "1.4%", better: "higher", history: [2.2, 4.9, 3.4, 1.4, 1.6, 3.0, 1.4, 1.4], unit: "%", symbols: ["EURUSD", "US30", "NAS100", "XAUUSD"], about: "Annualised change in the inflation-adjusted value of all goods and services produced." },
  { day: 3, time: "15:30", country: "us", currency: "USD", title: "Initial Jobless Claims", impact: 2, actual: "218K", forecast: "224K", previous: "222K", better: "lower", history: [231, 238, 233, 227, 232, 219, 222, 222], unit: "K", symbols: ["EURUSD", "XAUUSD"], about: "Number of people filing for unemployment benefits for the first time last week." },
  { day: 3, time: "15:30", country: "us", currency: "USD", title: "Durable Goods Orders m/m", impact: 2, actual: "0.0%", forecast: "-2.6%", previous: "9.8%", better: "higher", history: [-6.9, 0.2, -1.4, 0.6, -6.7, 9.9, 9.8, 9.8], unit: "%", symbols: ["US30", "EURUSD"], about: "Change in the value of new orders for long-lasting manufactured goods." },
  { day: 3, time: "16:20", country: "us", currency: "USD", title: "Fed Chair Powell Speaks", impact: 3, actual: "—", forecast: "—", previous: "—", better: "neutral", history: [], unit: "", symbols: ["EURUSD", "XAUUSD", "NAS100", "USDJPY"], about: "Pre-recorded remarks at the US Treasury Market Conference; no fresh policy guidance." },
  { day: 3, time: "17:00", country: "us", currency: "USD", title: "Pending Home Sales m/m", impact: 1, actual: "0.6%", forecast: "0.9%", previous: "-5.5%", better: "higher", history: [-7.7, 3.4, -2.1, -1.9, 4.8, -5.5, -5.5, -5.5], unit: "%", symbols: ["US30"], about: "Change in signed contracts for existing homes; leads existing home sales by a month or two." },
  { day: 3, time: "20:00", country: "us", currency: "USD", title: "7-Year Note Auction", impact: 1, forecast: "—", previous: "3.79%", better: "neutral", history: [4.2, 4.39, 4.55, 4.25, 4.1, 3.79, 3.79, 3.79], unit: "%", symbols: ["USDJPY"], about: "Average yield on 7-year Treasury notes sold at auction." },
  { day: 3, time: "22:00", country: "nz", currency: "NZD", title: "ANZ Business Confidence", impact: 1, forecast: "51.2", previous: "50.6", better: "higher", history: [-12.4, 14.9, 22.9, 11.2, -26.0, 27.1, 50.6, 50.6], unit: "", symbols: ["AUDUSD"], about: "Survey of New Zealand businesses about the 12-month outlook." },
  // Friday
  { day: 4, time: "02:30", country: "jp", currency: "JPY", title: "Tokyo Core CPI y/y", impact: 2, forecast: "2.0%", previous: "2.4%", better: "higher", history: [1.6, 1.6, 1.9, 2.2, 1.8, 2.2, 2.4, 2.4], unit: "%", symbols: ["USDJPY", "JP225"], about: "Early read on Japanese inflation, released about three weeks before the national figure." },
  { day: 4, time: "09:00", country: "gb", currency: "GBP", title: "Nationwide HPI m/m", impact: 1, forecast: "0.2%", previous: "-0.2%", better: "higher", history: [0.7, -0.4, 0.4, 0.4, 0.2, 0.3, -0.2, -0.2], unit: "%", symbols: ["GBPUSD"], about: "Change in UK house prices for properties with Nationwide mortgages." },
  { day: 4, time: "09:45", country: "eu", currency: "EUR", title: "French Consumer Spending m/m", impact: 1, forecast: "0.2%", previous: "0.3%", better: "higher", history: [-0.9, 1.4, -0.9, 1.5, -0.4, 0.3, 0.3, 0.3], unit: "%", symbols: ["EURUSD"], about: "Change in the inflation-adjusted value of goods bought by French consumers." },
  { day: 4, time: "10:00", country: "ch", currency: "CHF", title: "KOF Economic Barometer", impact: 1, forecast: "101.7", previous: "101.6", better: "higher", history: [101.0, 102.0, 101.8, 99.6, 102.4, 101.0, 101.6, 101.6], unit: "", symbols: ["USDCHF"], about: "Composite leading indicator for the Swiss economy." },
  { day: 4, time: "15:30", country: "us", currency: "USD", title: "Core PCE Price Index m/m", impact: 3, forecast: "0.2%", previous: "0.2%", better: "higher", history: [0.3, 0.5, 0.3, 0.3, 0.1, 0.2, 0.2, 0.2], unit: "%", symbols: ["EURUSD", "XAUUSD", "NAS100", "USDJPY"], about: "The Fed's preferred inflation gauge. A hot print would trim bets on a 50bp cut in November." },
  { day: 4, time: "15:30", country: "ca", currency: "CAD", title: "GDP m/m", impact: 2, forecast: "0.0%", previous: "0.1%", better: "higher", history: [0.3, 0.5, 0.2, 0.3, 0.3, 0.1, 0.1, 0.1], unit: "%", symbols: ["USDCAD"], about: "Monthly change in Canadian output; key for Bank of Canada expectations." },
  { day: 4, time: "15:30", country: "us", currency: "USD", title: "Personal Spending m/m", impact: 2, forecast: "0.3%", previous: "0.5%", better: "higher", history: [0.7, 0.2, 0.5, 0.3, 0.4, 0.3, 0.5, 0.5], unit: "%", symbols: ["EURUSD", "US30"], about: "Change in the inflation-adjusted value of spending by consumers." },
  { day: 4, time: "17:00", country: "us", currency: "USD", title: "UoM Consumer Sentiment (Final)", impact: 2, forecast: "69.3", previous: "69.0", better: "higher", history: [79.4, 77.2, 69.1, 68.2, 66.4, 67.9, 69.0, 69.0], unit: "", symbols: ["EURUSD", "US30"], about: "University of Michigan survey of consumers' view of the economy and inflation expectations." },
  { day: 4, time: "20:00", country: "us", currency: "USD", title: "Baker Hughes Oil Rig Count", impact: 1, forecast: "—", previous: "488", better: "neutral", history: [497, 496, 499, 497, 485, 483, 488, 488], unit: "", symbols: ["USOIL", "UKOIL"], about: "Number of active US oil rigs; a proxy for future supply." },
];

export const WEEK_EVENTS: WeekEvent[] = ev.map((e, i) => ({ ...e, id: `we${i + 1}` }));

/** Numeric value of a printed figure ("218K" → 218, "-4.5M" → -4.5, "3.0%" → 3). */
export function parseFigure(s?: string): number | null {
  if (!s || s === "—") return null;
  const n = parseFloat(s.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** +1 when actual beat forecast for the currency, -1 when it missed, 0 otherwise. */
export function surprise(e: WeekEvent): 1 | -1 | 0 {
  const a = parseFigure(e.actual);
  const f = parseFigure(e.forecast);
  if (a === null || f === null || a === f || e.better === "neutral") return 0;
  const higher = a > f;
  return (e.better === "higher" ? higher : !higher) ? 1 : -1;
}
