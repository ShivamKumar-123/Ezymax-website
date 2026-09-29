// Lots for the ladder's orders, per symbol on this phone. Starts from the Trade tab's last volume for the symbol
// (read only) or the symbol's minimum lot.
import * as React from "react";
import { kv } from "@/lib/kv";
import { clampLots } from "../trading/specs";
import type { SymbolSpec } from "../trading/types";

const KEY = "kalks.depthVolume";
const TRADE_KEY = "kalks.tradeVolume";

export function useLadderVolume(symbol: string, spec: SymbolSpec | undefined): [number, (v: number) => void] {
  const initial = React.useCallback(() => {
    const mine = kv.getJSON<Record<string, number>>(KEY)?.[symbol];
    const trade = kv.getJSON<Record<string, number>>(TRADE_KEY)?.[symbol];
    return clampLots(spec, mine ?? trade ?? spec?.lotMin ?? 0.01);
  }, [symbol, spec]);
  const [volume, setVolume] = React.useState(initial);
  React.useEffect(() => setVolume(initial()), [initial]);
  const set = React.useCallback(
    (v: number) => {
      const next = clampLots(spec, v);
      setVolume(next);
      const all = kv.getJSON<Record<string, number>>(KEY) ?? {};
      all[symbol] = next;
      kv.setJSON(KEY, all);
    },
    [symbol, spec],
  );
  return [volume, set];
}
