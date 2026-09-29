// Favourite symbols, per user on this phone. Toggling is optimistic (a UI preference, never money).
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import { onSignOut, sessionStore } from "@/session";

const DEFAULTS = ["EURUSD", "XAUUSD", "BTCUSD", "NAS100", "GBPUSD", "USOIL"];
const keyOf = (id: number) => `kalks.fav.${id}`;

export const favStore = createStore<string[]>(DEFAULTS);
let owner: number | null = null;

function hydrate() {
  const id = sessionStore.get().user?.id ?? null;
  if (id === owner) return;
  owner = id;
  favStore.set(id === null ? DEFAULTS : (kv.getJSON<string[]>(keyOf(id)) ?? DEFAULTS));
}
hydrate();
sessionStore.subscribe(hydrate);
onSignOut(() => {
  owner = null;
  favStore.set(DEFAULTS);
});

export function toggleFavourite(symbol: string): boolean {
  const list = favStore.get();
  const on = !list.includes(symbol);
  const next = on ? [...list, symbol] : list.filter((s) => s !== symbol);
  favStore.set(next);
  if (owner !== null) kv.setJSON(keyOf(owner), next);
  return on;
}

export const useFavourites = () => useStore(favStore);
export const useIsFavourite = (symbol: string) => useStore(favStore, (l) => l.includes(symbol));
