// Chart preferences on this phone: candles or line, and which indicators are on.
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import type { IndicatorKey } from "./indicators";
import type { ChartType } from "./SkiaChart";

type State = { type: ChartType; indicators: IndicatorKey[] };
const KEY = "kalks.chart";
export const chartSettings = createStore<State>(kv.getJSON<State>(KEY) ?? { type: "candles", indicators: ["ma"] });
chartSettings.subscribe(() => kv.setJSON(KEY, chartSettings.get()));

export const useChartType = () => useStore(chartSettings, (s) => s.type);
export const useIndicators = () => useStore(chartSettings, (s) => s.indicators);
export const setChartType = (type: ChartType) => chartSettings.set((s) => ({ ...s, type }));
export function toggleIndicator(k: IndicatorKey) {
  chartSettings.set((s) => ({ ...s, indicators: s.indicators.includes(k) ? s.indicators.filter((x) => x !== k) : [...s.indicators, k] }));
}
