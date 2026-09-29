// Connectivity: drives the offline banner / screen and tells streams to reconnect when the network is back.
import NetInfo from "@react-native-community/netinfo";
import { createStore, useStore } from "./store";

export const netStore = createStore<{ online: boolean }>({ online: true });

let started = false;
export function startNetWatch() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((s) => {
    const online = s.isConnected !== false && s.isInternetReachable !== false;
    if (online !== netStore.get().online) netStore.set({ online });
  });
  // web preview: NetInfo listens to navigator.connection only; the browser's online / offline events are the
  // reliable signal there (native builds don't have them)
  const w = globalThis as { addEventListener?: (type: string, fn: () => void) => void; navigator?: { onLine?: boolean } };
  if (typeof w.addEventListener === "function") {
    const sync = () => {
      const online = w.navigator?.onLine !== false;
      if (online !== netStore.get().online) netStore.set({ online });
    };
    w.addEventListener("online", sync);
    w.addEventListener("offline", sync);
  }
}

export const useOnline = () => useStore(netStore, (s) => s.online);
