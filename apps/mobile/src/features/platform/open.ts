// Opening a notification / deep link (resolved by links.ts): app screens through the router (a tab is switched to,
// a stack screen pushed), web pages in the in-app browser.
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { setTradeSymbol } from "@/features/trade/symbol";
import { i18n } from "@/i18n";
import { createStore, useStore } from "@/lib/store";
import { toast } from "@/ui";
import { colors } from "@/theme/tokens";
import { resolveLink, type Resolved } from "./links";
import { APP_HOSTS } from "./pending";

export const resolve = (link: string | null | undefined) => resolveLink(link, APP_HOSTS);

export async function openWeb(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url, { toolbarColor: colors.bg, controlsColor: colors.ember, dismissButtonStyle: "close", enableBarCollapsing: true, presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch {
    toast.show({ title: i18n.t("mobilePlatform.link.openFailed"), tone: "error" });
  }
}

/** Opens a resolved link. Returns false when there was nothing to open. */
export function openResolved(r: Resolved | null): boolean {
  if (!r) return false;
  if (r.kind === "web") {
    void openWeb(r.url);
    return true;
  }
  const [path, query = ""] = r.href.split("?");
  if (path === "/trade") {
    // the Trade tab shows the symbol the link names (its chart and order ticket)
    const symbol = /(?:^|&)symbol=([A-Za-z0-9._-]{1,32})(?:&|$)/.exec(query)?.[1];
    if (symbol) setTradeSymbol(symbol);
    router.navigate("/trade");
    return true;
  }
  if (r.tab) router.navigate(r.href as Href);
  else router.push(r.href as Href);
  return true;
}

/* A notification to show in full once the inbox is open (a push tap whose link is a web page, or no screen): the
   inbox opens the server's copy of it, so a link is only ever followed from the inbox, never from a push payload.
   A store, so an inbox that is already open reacts too. */
export type DetailRequest = { id: number; at: number } | null;
const detailStore = createStore<DetailRequest>(null);

export function requestInboxDetail(id: number | null) {
  detailStore.set(id === null ? null : { id, at: Date.now() });
}
export const clearInboxDetail = () => detailStore.set(null);
/** The notification the inbox should open (InboxScreen clears it once shown, or after a minute). */
export const useInboxDetailRequest = () => useStore(detailStore);
