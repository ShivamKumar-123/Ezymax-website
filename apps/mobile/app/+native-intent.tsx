// Incoming links before the router sees them (expo-router native intent; phones only, the web uses its URL as is):
// - Google sign-in returns through its OAuth redirect (<bundle id>:/oauthredirect); the auth session reads it, so the
//   router ignores it.
// - kalks://<path> and https://<Client Area host>/<path> (universal / app links, once the domain is associated: see
//   src/features/platform/README.md) open the matching app screen; Client Area paths the app names differently are
//   mapped (/portfolio/history -> /portfolio, /partner/payouts -> /partner …, src/features/platform/links.ts).
// - kalks://trade?symbol=XAUUSD shows that symbol on the Trade tab (the tab reads the symbol store, not the URL).
// - While signed out, a link to a signed-in screen shows sign-in first and opens right after it.
// Anything else (kalks://sign-up?ref=…, Expo Go URLs) goes to the router unchanged.
import { appPath } from "@/features/platform/links";
import { APP_HOSTS, rememberLink } from "@/features/platform/pending";
import { setTradeSymbol } from "@/features/trade/symbol";
import { sessionStore } from "@/session";

const OAUTH_REDIRECT = /^[a-z][a-z0-9+.-]*:\/{1,3}oauthredirect(?:[/?#]|$)/i;

function incoming(url: string): string | null {
  const custom = /^kalks:\/\/\/?(.*)$/i.exec(url);
  if (custom) return appPath(`/${custom[1] ?? ""}`);
  const web = /^https:\/\/([^/?#]+)(.*)$/i.exec(url);
  if (web && APP_HOSTS.includes((web[1] ?? "").toLowerCase())) return appPath(web[2] || "/");
  return null;
}

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (OAUTH_REDIRECT.test(path)) return initial ? "/" : null;
    const target = incoming(path);
    if (!target) return path;
    const status = sessionStore.get().status;
    if (status !== "signedIn") {
      // opened after the sign-in through the link resolver (PlatformRoot), which also sets a Trade symbol
      rememberLink(target);
      if (status === "signedOut") return "/";
    }
    const trade = /^\/trade\?(?:.*&)?symbol=([A-Za-z0-9._-]{1,32})(?:&|$)/.exec(target);
    if (trade?.[1]) {
      setTradeSymbol(trade[1]);
      return "/trade";
    }
    return target;
  } catch {
    return initial ? "/" : path;
  }
}
