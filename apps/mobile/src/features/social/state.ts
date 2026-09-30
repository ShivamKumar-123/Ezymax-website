// Small feature state: the leaderboard filters (kept on this phone), and web links for what is managed in the
// Client Area on the web (master dashboard, MAM programme).
import * as WebBrowser from "expo-web-browser";
import { kv } from "@/lib/kv";
import { API_BASE } from "@/lib/config";
import { createStore, useStore, shallowEqual } from "@/lib/store";
import { cachedConfig } from "@/market/config";
import { onSignOut } from "@/session";
import { colors } from "@/theme/tokens";
import type { LbFilters } from "./api";

const KEY = "kalks.social.filters";
export const DEFAULT_FILTERS: LbFilters = { period: "3m", sort: "return", program: "all", risk: "all", minDays: 0 };

function load(): LbFilters {
  const saved = kv.getJSON<Partial<LbFilters>>(KEY);
  return { ...DEFAULT_FILTERS, ...(saved ?? {}) };
}

export const filtersStore = createStore<LbFilters>(load());
filtersStore.subscribe(() => kv.setJSON(KEY, filtersStore.get()));
onSignOut(() => filtersStore.set(DEFAULT_FILTERS));

export const useFilters = () => useStore(filtersStore, (s) => s, shallowEqual);
export const setFilters = (patch: Partial<LbFilters>) => filtersStore.set((f) => ({ ...f, ...patch }));

/** Filters other than the period that narrow the list (for the "Filters · n" button and the empty state). */
export const activeFilterCount = (f: LbFilters) => (f.sort !== "return" ? 1 : 0) + (f.program !== "all" ? 1 : 0) + (f.risk !== "all" ? 1 : 0) + (f.minDays ? 1 : 0);
export const narrowed = (f: LbFilters) => f.program !== "all" || f.risk !== "all" || f.minDays > 0;

/** Opens a Client Area page on the web (in-app browser); the user signs in there with the same account. */
export function openClientArea(path: string) {
  const base = (cachedConfig()?.clientAreaUrl || API_BASE).replace(/\/+$/, "");
  void WebBrowser.openBrowserAsync(`${base}${path}`, { dismissButtonStyle: "close", controlsColor: colors.ember, toolbarColor: colors.bg }).catch(() => {});
}
