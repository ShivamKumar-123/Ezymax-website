"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ACCOUNTS, INSTRUMENT_MAP, priceFeed } from "@ezymex/mock";
import { LogoMark } from "@ezymex/ui";
import { tr, useT } from "@ezymex/i18n/react";
import { toast } from "@/lib/notify";
import { TerminalProvider, engineSession, guestSession, readActive, readSession, savedCharts, useTerminal, writeActive, writeSession, type Session } from "@/lib/store";
import { prefetchHistory } from "@/components/chart/engine";
import { CLIENT_AREA, GUEST_MODE } from "@/lib/guest";
import { engineApi } from "@/lib/engine/client";
import type { SessionInfo } from "@/lib/engine/types";
import { LoginDialog } from "./dialogs/login-dialog";
import { startMarket } from "@/lib/market";
import { DesktopTerminal } from "./shell/desktop";
import { useHotkeys } from "./shell/hotkeys";
import { MobileTerminal } from "./mobile/mobile-terminal";
import { NewOrderDialog } from "./order/new-order-dialog";
import { PendingDialog, PositionDialog } from "./dialogs/position-dialog";
import { AboutDialog, GlossaryDialog, OptionsDialog, ShortcutsDialog, SpecDialog, SymbolSearch } from "./dialogs/misc-dialogs";
import { IndicatorDialogs } from "./chart/indicators/dialogs";
import { ShareLayer } from "./share/share-dialogs";
import { ConfirmLayer } from "./dialogs/confirm";
import { ControlsBanner } from "./shell/controls-banner";
import { CopyBanner } from "./shell/copy-banner";
import { accountForLink, linkProduct, productOf, rememberLinkUnderlying, useTradeMode, type TradeMode } from "@/lib/options/mode";

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

export function Splash({ text }: { text?: string }) {
  const t = useT();
  const label = text ?? (GUEST_MODE ? t("trader.splash.connecting", { server: "Ezymex" }) : t("trader.splash.connecting", { server: "Ezymex-Live01" }));
  return (
    <div className="grid h-dvh place-items-center bg-page">
      <div className="flex flex-col items-center gap-3">
        <span className="grid size-12 place-items-center rounded-[12px] border border-line-top bg-surface-3">
          <LogoMark size={22} className="text-fg" />
        </span>
        <div className="text-[13px] font-semibold">
          Ezymex <span className="font-normal text-fg-2">Trader</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-fg-3">
          <span className="size-1.5 rounded-full bg-ember" />
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * A link asked for the other product than the account it would open on (`?mode=options` on a CFD account, a CFD
 * market on an Options account): the terminal opened the client's account of that product, or there is none.
 */
type LinkNote = { switched: string; product: TradeMode } | { missing: TradeMode };

/** The account a link opens on: `chosen`, or one of the product the link asks for when `chosen` trades the other. */
function followLink<A extends { login: string; type: string; product?: string | null }>(accounts: A[], chosen: A | undefined, want: TradeMode | null): { pick: A | undefined; note: LinkNote | null } {
  if (!want || !chosen || productOf(chosen) === want) return { pick: chosen, note: null };
  const other = accountForLink(accounts, chosen, want);
  return other ? { pick: other, note: { switched: other.login, product: want } } : { pick: chosen, note: { missing: want } };
}

/**
 * Live builds pick the session from the trading engine: `?sso=<token>` (Client Area Trade button) is
 * redeemed by the BFF first; then every login this browser holds (HttpOnly cookie) is listed and the
 * active one is `?account=`, else the last one shown, else the newest. No login → guest chart mode.
 * A link for the other product (`want`) opens one of this browser's logins of that product instead, if any.
 */
async function liveEntry(sp: URLSearchParams, want: TradeMode | null): Promise<{ session: Session; sessions: SessionInfo[]; note: LinkNote | null }> {
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
    } else toast.error(tr("trader.toast.ssoRejected"), { description: r.err.message });
  }
  const list = await engineApi.sessions();
  const sessions = list.ok ? list.data.sessions : [];
  if (!list.ok) toast.error(tr("trader.toast.serverUnavailable"), { description: tr("trader.toast.serverUnavailableHint") });
  const chosen = sessions.find((x) => x.login === prefer) ?? sessions.find((x) => x.login === readActive()) ?? sessions[0];
  if (!chosen) {
    if (prefer && !sso) window.location.replace(`/login?login=${encodeURIComponent(prefer)}`);
    return { session: guestSession(), sessions: [], note: null };
  }
  const views = sessions.map((x) => ({ x, login: x.login, type: x.account?.type ?? "", product: x.account?.product }));
  const link = followLink(views, views.find((v) => v.x === chosen), want);
  const pick = link.pick?.x ?? chosen;
  writeActive(pick.login);
  return { session: engineSession(pick, via), sessions, note: link.note };
}

/**
 * Entry. Live builds: see liveEntry(). Demo builds: SSO via `?account=` (from the Client Area), else a
 * saved session, else /login.
 * `?symbol=` opens that symbol in the active chart; `?side=buy|sell` opens a prefilled order. The account's product
 * decides CFD or Options: `?mode=options|cfd` (and a CFD `?symbol=` on an Options account) moves to the client's
 * account of that product when there is one, never forces the mode (lib/options/mode.ts).
 */
export function Terminal() {
  const sp = useSearchParams();
  const router = useRouter();
  const [session, setSession] = React.useState<Session | null>(null);
  const [sessions, setSessions] = React.useState<SessionInfo[]>([]);
  const [note, setNote] = React.useState<LinkNote | null>(null);
  // read before liveEntry() / the demo SSO wipe the query string (`?sso=…&mode=options` from the Client Area's
  // Options page, `?mode=options&u=EURUSD` from the public option chain). The mode never overrides the account's
  // product: it picks the client's account of that product (followLink); the underlying waits for the options workspace.
  const [intent] = React.useState(() => {
    const link = { symbol: sp.get("symbol")?.toUpperCase() ?? null, side: sp.get("side"), mode: sp.get("mode") };
    rememberLinkUnderlying(sp.get("u"));
    return { ...link, want: linkProduct(link) };
  });

  React.useEffect(() => {
    const acc = sp.get("account");
    let s: Session | null = null;
    if (GUEST_MODE) {
      let alive = true;
      const feed = priceFeed();
      feed.markHydrated();
      // chart history doesn't depend on the session: request the saved layout's charts now, not after sign-in
      for (const c of savedCharts()) prefetchHistory(c.symbol, c.tf);
      void liveEntry(new URLSearchParams(sp.toString()), intent.want).then(async (r) => {
        if (!alive) return;
        if (window.location.search) window.history.replaceState(null, "", "/");
        const g = r.sessions.find((x) => x.login === r.session.login)?.account?.spreadGroup;
        if (g) feed.setGroup(g); // quotes carry the account group's spread (what the engine fills at)
        await feed.ready;
        if (!alive) return;
        startMarket();
        setSessions(r.sessions);
        setNote(r.note);
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
    // a link for the other product: the client's sample account of that product
    const link = followLink(ACCOUNTS, ACCOUNTS.find((x) => x.login === s!.login), intent.want);
    if (link.pick && link.pick.login !== s.login) {
      s = { ...s, login: link.pick.login, server: link.pick.server, investor: false, at: Date.now() };
      writeSession(s);
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
      setNote(link.note);
      setSession(s);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session) return <Splash />;
  return (
    <TerminalProvider initialSession={session} engineSessions={sessions} guestMode={intent.want} onLogout={(to) => (GUEST_MODE ? window.location.replace(to ?? "/login?logout=1") : router.replace("/login?logout=1"))}>
      <Shell intent={intent} note={note} />
    </TerminalProvider>
  );
}

function Shell({ intent, note }: { intent: { symbol: string | null; side: string | null }; note: LinkNote | null }) {
  const T = useTerminal();
  const mobile = useIsMobile();
  const mode = useTradeMode();
  useHotkeys();
  React.useEffect(() => {
    // the link asked for the other product: which account the terminal opened on, or that the client has none (the
    // Client Area's open-account wizard starts with the product)
    if (note && "switched" in note) toast.success(tr(note.product === "options" ? "accounts.product.switchedOptions" : "accounts.product.switchedCfd", { login: note.switched }));
    else if (note?.missing === "options") toast(tr("accounts.product.noOptionsAccount"), { duration: 10_000, action: { label: tr("accounts.product.openOptions"), onClick: () => window.open(`${CLIENT_AREA}/accounts/new?product=options`, "_blank", "noopener") } });
    else if (note?.missing === "cfd") toast(tr("accounts.product.optionsOnly"), { id: "product-options-only" });
    // a CFD market: its chart, and for `?side=` the order form (on an Options account the store explains instead)
    const sym = intent.symbol && INSTRUMENT_MAP[intent.symbol] ? intent.symbol : null;
    if (sym && mode === "cfd") T.openSymbol(sym);
    if (intent.side === "buy" || intent.side === "sell") T.openNewOrder({ symbol: sym ?? T.activeSymbol, side: intent.side, type: "market" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {/* staff session / account restrictions banner above the terminal (shell/controls-banner.tsx) */}
      <div className="flex h-dvh flex-col">
        <ControlsBanner />
        <CopyBanner />
        <div className="min-h-0 flex-1 [&>div]:h-full">{mobile ? <MobileTerminal /> : <DesktopTerminal />}</div>
      </div>
      <NewOrderDialog />
      <PositionDialog />
      <PendingDialog />
      <SymbolSearch />
      <ShortcutsDialog />
      <SpecDialog />
      <AboutDialog />
      <GlossaryDialog />
      <OptionsDialog />
      <IndicatorDialogs />
      <ShareLayer />
      <ConfirmLayer />
      {T.live && <LoginDialog />}
    </>
  );
}
