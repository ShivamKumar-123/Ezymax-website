"use client";

import * as React from "react";
import { IS_DEMO } from "@kalks/mock/mode";
import { useStaff } from "@/components/staff-session";
import { LocalTradingDesk } from "./store";
import { RestTradingDesk } from "./rest";
import type { DeskState, TradingDeskApi } from "./types";

/** One desk per browser tab: demo builds simulate it in localStorage, live builds talk to the trading engine. */
type Desk = TradingDeskApi & { hydrate(): void };
let singleton: Desk | null = null;
function getDesk(): Desk {
  if (!singleton) singleton = IS_DEMO ? new LocalTradingDesk() : new RestTradingDesk();
  return singleton;
}
const SERVER_STATE = IS_DEMO ? LocalTradingDesk.serverState : RestTradingDesk.serverState;

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
  const state = React.useSyncExternalStore(api.subscribe, api.getState, () => SERVER_STATE);
  return { state, api };
}

/** Live desk only: whether the first load finished and whether the dealing stream is connected. */
export function useDeskStatus(): { ready: boolean; status: "connecting" | "live" | "offline" | "demo" } {
  const api = useDeskApi();
  React.useSyncExternalStore(api.subscribe, api.getState, () => SERVER_STATE);
  if (api instanceof RestTradingDesk) return { ready: api.ready, status: api.status };
  return { ready: true, status: "demo" };
}

/** Live desk only: the RestTradingDesk (older audit pages, reload). */
export function useRestDesk(): RestTradingDesk | null {
  const api = useDeskApi();
  return api instanceof RestTradingDesk ? api : null;
}
