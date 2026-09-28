"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ACCOUNTS, INSTRUMENTS, priceFeed } from "@kalks/mock";
import { LogoMark } from "@kalks/ui";
import { toast } from "@/lib/notify";
import { TerminalProvider, engineSession, guestSession, readActive, readSession, useTerminal, writeActive, writeSession, type Session } from "@/lib/store";
import { GUEST_MODE } from "@/lib/guest";
import { engineApi } from "@/lib/engine/client";
import type { SessionInfo } from "@/lib/engine/types";
import { LoginDialog } from "./dialogs/login-dialog";
import { startMarket } from "@/lib/market";
import { DesktopTerminal } from "./shell/desktop";
import { useHotkeys } from "./shell/hotkeys";
import { MobileTerminal } from "./mobile/mobile-terminal";
import { NewOrderDialog } from "./order/new-order-dialog";
import { PendingDialog, PositionDialog } from "./dialogs/position-dialog";
import { AboutDialog, ShortcutsDialog, SpecDialog, SymbolSearch } from "./dialogs/misc-dialogs";
import { IndicatorDialogs } from "./chart/indicators/dialogs";
import { ShareLayer } from "./share/share-dialogs";

function useIsMobile() {
  const [m, setM] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return m;
}

export function Splash({ text = GUEST_MODE ? "Connecting to Kalks…" : "Connecting to Kalks-Live01…" }: { text?: string }) {
  return (
    <div className="grid h-dvh place-items-center bg-page">
      <div className="flex flex-col items-center gap-3">
        <span className="grid size-12 place-items-center rounded-[12px] border border-line-top bg-surface-3 shadow-[0_0_30px_-8px_rgba(255,90,31,0.7)]">
          <LogoMark size={22} className="text-fg" />
        </span>
        <div className="text-[13px] font-semibold">
          Kalks <span className="font-normal text-fg-2">Trader</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-fg-3">
          <span className="t-live-dot size-1.5 rounded-full bg-ember" />
          {text}
        </div>
      </div>
    </div>
  );
}

/**
 * Live builds pick the session from the trading engine: `?sso=<token>` (Client Area Trade button) is
 * redeemed by the BFF first; then every login this browser holds (HttpOnly cookie) is listed and the
 * active one is `?account=`, else the last one shown, else the newest. No login → guest chart mode.
 */
async function liveEntry(sp: URLSearchParams): Promise<{ session: Session; sessions: SessionInfo[] }> {
  const sso = sp.get("sso");
  let prefer = sp.get("account");
  let via: Session["via"] = "login";
  if (sso) {
    // drop the one-time token from the address bar (and history) before anything else
    window.history.replaceState(null, "", "/");
    const r = await engineApi.sso(sso);
    if (r.ok) {
      prefer = r.data.login;
      via = "sso";
    } else toast.error("Sign-in link not accepted", { description: r.err.message });
  }
  const list = await engineApi.sessions();
  const sessions = list.ok ? list.data.sessions : [];
  if (!list.ok) toast.error("Trade server unavailable", { description: "Showing charts only. Your trading session will reconnect when you reload." });
  const pick = sessions.find((x) => x.login === prefer) ?? sessions.find((x) => x.login === readActive()) ?? sessions[0];
  if (!pick) {
    if (prefer && !sso) window.location.replace(`/login?login=${encodeURIComponent(prefer)}`);
    return { session: guestSession(), sessions: [] };
  }
  writeActive(pick.login);
  return { session: engineSession(pick, via), sessions };
}

/**
 * Entry. Live builds: see liveEntry(). Demo builds: SSO via `?account=` (from the Client Area), else a
 * saved session, else /login.
 * `?symbol=` opens that symbol in the active chart; `?side=buy|sell` opens a prefilled order.
 */
export function Terminal() {
  const sp = useSearchParams();
  const router = useRouter();
  const [session, setSession] = React.useState<Session | null>(null);
  const [sessions, setSessions] = React.useState<SessionInfo[]>([]);
  const [intent] = React.useState(() => ({ symbol: sp.get("symbol")?.toUpperCase() ?? null, side: sp.get("side") }));

  React.useEffect(() => {
    const acc = sp.get("account");
    let s: Session | null = null;
    if (GUEST_MODE) {
      let alive = true;
      const feed = priceFeed();
      feed.markHydrated();
      void liveEntry(new URLSearchParams(sp.toString())).then(async (r) => {
        if (!alive) return;
        if (window.location.search) window.history.replaceState(null, "", "/");
        const g = r.sessions.find((x) => x.login === r.session.login)?.account?.spreadGroup;
        if (g) feed.setGroup(g); // quotes carry the account group's spread (what the engine fills at)
        await feed.ready;
        if (!alive) return;
        startMarket();
        setSessions(r.sessions);
        setSession(r.session);
      });
      return () => {
        alive = false;
      };
    } else if (acc) {
      const a = ACCOUNTS.find((x) => x.login === acc);
      if (!a) {
        router.replace(`/login?error=unknown&login=${encodeURIComponent(acc)}`);
        return;
      }
      s = { login: a.login, investor: false, server: a.server, via: "sso", at: Date.now() };
      writeSession(s);
    } else {
      s = readSession();
      if (!s || !ACCOUNTS.some((x) => x.login === s!.login)) {
        router.replace("/login");
        return;
      }
    }
    if (sp.toString()) window.history.replaceState(null, "", "/");
    // live prices (with this account group's spread) before the terminal mounts
    const feed = priceFeed();
    feed.markHydrated();
    const group = ACCOUNTS.find((x) => x.login === s!.login)?.group;
    if (group) feed.setGroup(group); // guest: the default (standard) spread
    let alive = true;
    void feed.ready.then(() => {
      if (!alive) return;
      startMarket();
      setSession(s);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return <Splash />;
  return (
    <TerminalProvider initialSession={session} engineSessions={sessions} onLogout={(to) => (GUEST_MODE ? window.location.replace(to ?? "/login?logout=1") : router.replace("/login?logout=1"))}>
      <Shell intent={intent} />
    </TerminalProvider>
  );
}

function Shell({ intent }: { intent: { symbol: string | null; side: string | null } }) {
  const T = useTerminal();
  const mobile = useIsMobile();
  useHotkeys();
  React.useEffect(() => {
    const sym = intent.symbol && INSTRUMENTS.some((i) => i.symbol === intent.symbol) ? intent.symbol : null;
    if (sym) T.openSymbol(sym);
    if (intent.side === "buy" || intent.side === "sell") T.openNewOrder({ symbol: sym ?? T.activeSymbol, side: intent.side, type: "market" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {mobile ? <MobileTerminal /> : <DesktopTerminal />}
      <NewOrderDialog />
      <PositionDialog />
      <PendingDialog />
      <SymbolSearch />
      <ShortcutsDialog />
      <SpecDialog />
      <AboutDialog />
      <IndicatorDialogs />
      <ShareLayer />
      {T.live && <LoginDialog />}
    </>
  );
}
