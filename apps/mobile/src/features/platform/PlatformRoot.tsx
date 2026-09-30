// Phone-level services of the signed-in app, mounted once in app/(app)/_layout.tsx next to the navigator:
// - the app lock over everything (cold start, background timeout, app-switcher cover; lock/);
// - push: permission and registration (never prompting by itself), the soft ask on Home from the second launch,
//   pushes that arrive while the app is open (in-app banner, inbox and bell refresh), and taps on pushes (open the
//   notification's screen, mark it read), including the tap that launched the app;
// - a deep link that arrived while signed out opens right after the sign-in.
// Renders only overlays; a price tick never re-renders it (only SoftAsk follows the route).
import * as React from "react";
import { AppState } from "react-native";
import { router, usePathname, type Href } from "expo-router";
import { invalidate } from "@/lib/query";
import { onSignOut, sessionStore, useSession } from "@/session";
import { watchAppState, useLocked, lockStore } from "./lock/state";
import { LockOverlay } from "./lock/LockOverlay";
import { markRead, setUnread } from "./notifications/api";
import { openResolved, requestInboxDetail, resolve } from "./open";
import { takePendingLink } from "./pending";
import { onPushOpened, onPushReceived, pushAllowed, refreshPermission, registerPush, unregisterPush, type PushPayload } from "./push";
import { mayAsk, PushAskSheet, PushBanner, showPushBanner } from "./push/PushUI";

// sign-out on this phone (or the session ended elsewhere): stop pushes to it, clear its notifications and badge
onSignOut(({ remote }) => unregisterPush(remote));

const mine = (p: PushPayload) => p.uid === null || p.uid === sessionStore.get().user?.id;

/** The screen on show (kept by SoftAsk, which follows the route anyway). */
let currentPath = "";

/**
 * Opens a push the reader tapped and marks it read: an app screen directly; anything else (a web page, no screen)
 * in the inbox, which shows the server's copy of that notification. A push payload's own URL is never opened, so a
 * push that didn't come from our server can't open a page inside the app.
 */
function openPush(p: PushPayload) {
  if (!mine(p)) return; // sent to someone who has since signed out on this phone
  if (p.id !== null) {
    void markRead([p.id]).then((r) => {
      if (r.ok) setUnread(r.data.unread);
    });
  }
  invalidate("platform:inbox");
  // after the navigator has settled (a tap can launch the app)
  setTimeout(() => {
    const target = resolve(p.link);
    if (target?.kind === "route") {
      openResolved(target);
      return;
    }
    requestInboxDetail(p.id);
    if (currentPath !== "/notifications") router.navigate("/notifications");
  }, 0);
}

export const PlatformRoot = React.memo(function PlatformRoot() {
  const locked = useLocked();
  // pushes are for the client's own sessions (not view-only logins or staff "log in as client" sessions)
  const allowed = useSession(pushAllowed);

  React.useEffect(() => {
    watchAppState();
    // a link that arrived while signed out (this session started with a sign-in just now)
    const href = takePendingLink();
    if (href) setTimeout(() => router.push(href as Href), 0);
  }, []);

  // push registration now and whenever the app comes back (the permission may have changed in Settings)
  React.useEffect(() => {
    if (!allowed) return;
    void registerPush();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void registerPush();
    });
    return () => sub.remove();
  }, [allowed]);

  React.useEffect(() => {
    const offReceived = onPushReceived((p) => {
      if (!mine(p)) return;
      invalidate("platform:inbox");
      if (p.badge !== null) setUnread(p.badge);
      else invalidate("home/bell");
      // the inbox shows it in the list already; a locked app shows nothing
      if (!lockStore.get().locked && currentPath !== "/notifications") showPushBanner(p);
    });
    const offOpened = onPushOpened(openPush);
    return () => {
      offReceived();
      offOpened();
    };
  }, []);

  return (
    <>
      <PushBanner hidden={locked} onOpen={openPush} />
      {allowed ? <SoftAsk locked={locked} /> : null}
      <LockOverlay />
    </>
  );
});

/** The soft ask: on Home, unlocked, a moment after it settles, and only when it may show at all (PushUI.mayAsk). */
function SoftAsk({ locked }: { locked: boolean }) {
  const pathname = usePathname();
  const ask = React.useRef<{ present: () => void }>(null);
  React.useEffect(() => {
    currentPath = pathname;
  }, [pathname]);
  React.useEffect(() => {
    if (locked || pathname !== "/" || !mayAsk()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || (await refreshPermission()) !== "undetermined" || cancelled || !mayAsk()) return;
      ask.current?.present();
    }, 1600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locked, pathname]);
  return <PushAskSheet ref={ask} />;
}
