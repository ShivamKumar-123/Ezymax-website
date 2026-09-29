// Opening a notification / deep link (resolved by links.ts): app screens through the router (a tab is switched to,
// a stack screen pushed), web pages in the in-app browser.
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { i18n } from "@/i18n";
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
  if (r.tab) router.navigate(r.href as Href);
  else router.push(r.href as Href);
  return true;
}
