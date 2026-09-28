"use client";

import * as React from "react";
import { useStaff } from "@/components/staff-session";
import { LocalTradingDesk } from "./store";
import type { DeskState, TradingDeskApi } from "./types";

/** One desk per browser tab. Swap LocalTradingDesk for a REST implementation when the trading engine exists. */
let singleton: LocalTradingDesk | null = null;
function getDesk() {
  if (!singleton) singleton = new LocalTradingDesk();
  return singleton;
}

const DeskContext = React.createContext<TradingDeskApi | null>(null);

export function TradingDeskProvider({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  const desk = getDesk();
  desk.setActor({ id: staff.id, name: staff.name, role: staff.role_label || staff.role });
  React.useEffect(() => {
    desk.hydrate();
  }, [desk]);
  return <DeskContext.Provider value={desk}>{children}</DeskContext.Provider>;
}

export function useDeskApi(): TradingDeskApi {
  const d = React.useContext(DeskContext);
  if (!d) throw new Error("useDeskApi must be used inside TradingDeskProvider");
  return d;
}

/** Subscribe to the desk state (re-renders on every desk change). */
export function useDesk(): { state: DeskState; api: TradingDeskApi } {
  const api = useDeskApi();
  const state = React.useSyncExternalStore(api.subscribe, api.getState, () => LocalTradingDesk.serverState);
  return { state, api };
}
