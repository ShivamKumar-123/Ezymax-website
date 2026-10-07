"use client";

// Options mode in the right-hand column (components/shell/side-column.tsx): the underlyings, the selected option's
// order book (or the underlying's spot depth while the options book is off) and its trades / ticks.
import * as React from "react";
import { useTerminal } from "@/lib/store";
import { useOptionsAttach } from "@/lib/options-store";
import { InstrumentList } from "./instruments";
import { OptionsBookBody, useOptionsTradesLabel } from "./book-card";

export function OptionsSide({ tab }: { tab: "instruments" | "book" | "ticks" }) {
  const T = useTerminal();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  if (tab === "instruments") return <InstrumentList />;
  return <OptionsBookBody tab={tab === "book" ? "book" : "trades"} />;
}

export function OptionsTradesLabel() {
  return <>{useOptionsTradesLabel()}</>;
}
