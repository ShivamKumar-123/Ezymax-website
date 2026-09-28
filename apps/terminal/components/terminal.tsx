"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ACCOUNTS, INSTRUMENTS, priceFeed } from "@kalks/mock";
import { LogoMark } from "@kalks/ui";
import { TerminalProvider, guestSession, readSession, useTerminal, writeSession, type Session } from "@/lib/store";
import { GUEST_MODE } from "@/lib/guest";
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

export function Splash({ text = GUEST_MODE ? "Connecting to Kalks market data…" : "Connecting to Kalks-Live01…" }: { text?: string }) {
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
 * Entry: SSO via `?account=` (from the Client Area), else a saved session, else /login.
 * Live builds have no trading accounts yet: every entry (with or without `?account=`) opens guest mode.
 * `?symbol=` opens that symbol in the active chart; `?side=buy|sell` opens a prefilled order.
 */
export function Terminal() {
  const sp = useSearchParams();
  const router = useRouter();
  const [session, setSession] = React.useState<Session | null>(null);
  const [intent] = React.useState(() => ({ symbol: sp.get("symbol")?.toUpperCase() ?? null, side: sp.get("side") }));

  React.useEffect(() => {
    const acc = sp.get("account");
    let s: Session | null = null;
    if (GUEST_MODE) s = guestSession();
    else if (acc) {
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
    <TerminalProvider initialSession={session} onLogout={() => router.replace(GUEST_MODE ? "/login" : "/login?logout=1")}>
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
    </>
  );
}
