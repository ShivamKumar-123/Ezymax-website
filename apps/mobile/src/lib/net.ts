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
}

export const useOnline = () => useStore(netStore, (s) => s.online);
