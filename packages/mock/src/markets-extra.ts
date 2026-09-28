import { INSTRUMENTS, type AssetClass, type Instrument } from "./symbols";
import { seeded, hashString } from "./rng";

export interface ContractSpec {
  symbol: string;
  digits: number;
  contractSize: number;
  contractUnit: string;
  minLot: number;
  maxLot: number;
  lotStep: number;
  leverage: number;
  marginCurrency: string;
  swapLong: number;
  swapShort: number;
  swapType: string;
  tripleSwap: string;
  stopsLevel: number;
  spreadPips: number;
  spreadLabel: string;
  /** Mon..Sun trading sessions in server time GMT+3 */
  hours: { day: string; sessions: string }[];
  hoursShort: string;
  openNow: boolean;
}

const HOURS: Record<AssetClass, { week: string; sat: string; sun: string; short: string }> = {
  forex: { week: "00:05 – 23:55", sat: "Closed", sun: "Closed", short: "24/5" },
  metals: { week: "01:05 – 23:55", sat: "Closed", sun: "Closed", short: "24/5 · 1h break" },
  indices: { week: "01:05 – 23:50", sat: "Closed", sun: "Closed", short: "23/5" },
  energies: { week: "01:05 – 23:55", sat: "Closed", sun: "Closed", short: "23/5" },
  crypto: { week: "00:00 – 24:00", sat: "00:00 – 24:00", sun: "00:00 – 24:00", short: "24/7" },
  stocks: { week: "16:30 – 23:00", sat: "Closed", sun: "Closed", short: "US session" },
};

const LEVERAGE: Record<AssetClass, number> = { forex: 1000, metals: 500, indices: 200, energies: 200, crypto: 100, stocks: 20 };
const UNIT: Record<AssetClass, string> = { forex: "units of base", metals: "troy oz", indices: "× index", energies: "barrels", crypto: "coin", stocks: "share" };

export function contractSpec(inst: Instrument): ContractSpec {
  const r = seeded(hashString("spec" + inst.symbol));
  const h = HOURS[inst.assetClass];
  const pip = inst.digits === 5 || inst.digits === 3 ? Math.pow(10, -(inst.digits - 1)) : Math.pow(10, -inst.digits);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return {
    symbol: inst.symbol,
    digits: inst.digits,
    contractSize: inst.contractSize,
    contractUnit: inst.symbol === "XAGUSD" ? "troy oz" : UNIT[inst.assetClass],
    minLot: 0.01,
    maxLot: inst.assetClass === "forex" ? 200 : inst.assetClass === "stocks" ? 500 : 100,
    lotStep: 0.01,
    leverage: LEVERAGE[inst.assetClass],
    marginCurrency: inst.assetClass === "forex" ? inst.symbol.slice(0, 3) : "USD",
    swapLong: +(-r.range(0.5, 12) * (inst.assetClass === "crypto" ? 3 : 1)).toFixed(2),
    swapShort: +(r.range(-6, 4)).toFixed(2),
    swapType: inst.assetClass === "crypto" || inst.assetClass === "stocks" ? "Percent per year" : "Points",
    tripleSwap: "Wednesday",
    stopsLevel: 0,
    spreadPips: +(inst.spread / pip).toFixed(1),
    spreadLabel: inst.assetClass === "forex" ? `${+(inst.spread / pip).toFixed(1)} pips` : `${inst.spread.toFixed(inst.digits)} ${inst.assetClass === "crypto" || inst.assetClass === "stocks" ? "USD" : "pts"}`,
    hours: days.map((day, i) => ({ day, sessions: i === 5 ? h.sat : i === 6 ? h.sun : i === 4 && inst.assetClass !== "crypto" ? h.week.replace(/23:5\d|23:00/, "23:45") : h.week })),
    hoursShort: h.short,
    openNow: true,
  };
}

export const CONTRACT_SPECS: Record<string, ContractSpec> = Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, contractSpec(i)]));

export const DEFAULT_FAVOURITES = ["XAUUSD", "EURUSD", "NAS100", "BTCUSD"];
