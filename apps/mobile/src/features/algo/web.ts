// Pages that stay on the web (creating API keys and webhooks, editing code strategies, publishing to the
// marketplace): opened in the in-app browser on the broker's Client Area, where the client signs in with the same
// account.
import * as WebBrowser from "expo-web-browser";
import { API_BASE } from "@/lib/config";
import { cachedConfig } from "@/market/config";
import { colors } from "@/theme/tokens";

export function openClientArea(path: string) {
  const base = (cachedConfig()?.clientAreaUrl || API_BASE).replace(/\/+$/, "");
  void WebBrowser.openBrowserAsync(`${base}${path}`, { dismissButtonStyle: "close", controlsColor: colors.ember, toolbarColor: colors.bg }).catch(() => {});
}
