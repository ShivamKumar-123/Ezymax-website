// Links that arrive while signed out (app/+native-intent.tsx) wait here and open right after the sign-in
// (PlatformRoot). No router import: +native-intent loads this while expo-router itself is starting.
import { API_BASE } from "@/lib/config";
import { sessionStore } from "@/session";

/** Hosts whose https:// links are this app's own Client Area (they open the matching screen). */
export const APP_HOSTS: readonly string[] = (() => {
  const m = /^https?:\/\/([^/?#]+)/i.exec(API_BASE);
  return m?.[1] ? [m[1].toLowerCase()] : [];
})();

let pending: { href: string; at: number } | null = null;
// whether this run of the app has been signed out at some point: only then did a sign-in follow the link (a session
// restored at start already opened it through the router)
let signedOutThisRun = sessionStore.get().status === "signedOut";
sessionStore.subscribe(() => {
  if (sessionStore.get().status === "signedOut") signedOutThisRun = true;
});

/** A link for an app screen that arrived while signed out (or before the session was known). */
export function rememberLink(href: string) {
  pending = { href, at: Date.now() };
}

/** The remembered link, once, if a sign-in followed it within 10 minutes. */
export function takePendingLink(): string | null {
  const p = pending;
  pending = null;
  return p && signedOutThisRun && Date.now() - p.at < 10 * 60_000 ? p.href : null;
}
