// One-tap trading (the MT5 "one click trading" setting) for this phone: off by default. When on, a tap on a ladder
// level or on Sell / Buy sends the order at once; when off, the order is reviewed in a sheet first. Turning it on
// goes through an explanation sheet (components/OneTapSheet). Reset on sign-out, so the next person to sign in on
// the phone starts with confirmations. Other trading screens can read the same setting (useOneTap / oneTapStore).
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import { onSignOut } from "@/session";

const KEY = "kalks.oneTap";

export const oneTapStore = createStore<boolean>(kv.get(KEY) === "1");

export const useOneTap = () => useStore(oneTapStore);

export function setOneTap(on: boolean) {
  kv.set(KEY, on ? "1" : "0");
  oneTapStore.set(on);
}

onSignOut(() => setOneTap(false));
