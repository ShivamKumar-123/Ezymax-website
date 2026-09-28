"use client";

import * as React from "react";
import { isMarketOpen } from "@kalks/mock";

/** Re-evaluates the symbol's session every 15 s so buttons flip at the open/close without a reload. */
export function useMarketOpen(symbol: string): boolean {
  const [open, setOpen] = React.useState(() => isMarketOpen(symbol));
  React.useEffect(() => {
    setOpen(isMarketOpen(symbol));
    const t = setInterval(() => setOpen(isMarketOpen(symbol)), 15_000);
    return () => clearInterval(t);
  }, [symbol]);
  return open;
}
