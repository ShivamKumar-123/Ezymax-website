"use client";

// The bar at the bottom of the first screen (docs/TERMINAL-DESIGN.md §2.2): account health (balance, equity, P&L,
// margin, free margin, margin level), one dot for the connection, and the "Positions (3) ↓" button that scrolls the
// page down to the positions. Theme, sounds, shortcuts and support live in the ☰ menu.
// The dot is green and wordless while the prices and the trade server are both fine; a slow feed, a simulated feed or
// a trade server that is not up puts its words back, in warning colour. The server, the quote rate, the delay and the
// clock are on its tooltip - the chart prints that clock two rows above, so the bar does not print it again.
import * as React from "react";
import { ArrowDown, ChevronDown, ChevronUp } from "lucide-react";
import { priceFeed } from "@ezymex/mock";
import { cn, useFeedMode } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { useQps } from "@/lib/market";
import { serverTime, serverZone } from "@/lib/trading";
import { useStreamStatus } from "@/lib/engine/live";
import { CountBadge, Tip } from "@/components/ui/kit";
import { AccountHealth } from "./account-health";
import { scrollToActivity } from "./commands";
import { useActivityTabs } from "@/components/toolbox/toolbox";

function useTicker(ms: number) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
  return n;
}

/** Connection pill: prices (simulated / connecting / connected with delay) and, on live builds, the trade server. */
function Connection() {
  const T = useTerminal();
  const t = useT();
  const qps = useQps();
  useTicker(1000);
  const mode = useFeedMode();
  // real feed latency: browser receive − market-data service receive, p95 of the last 500 quotes
  const lat = priceFeed().latency();
  // the sample compares two clocks: a browser clock that is off by minutes gives nonsense, shown as "—"
  const ping = lat.n && lat.p95 >= 0 && lat.p95 < 60_000 ? lat.p95 : null;
  const ok = mode === "live" && (ping === null || ping < 150);
  const st = serverTime();
  // the server's real offset (UTC+3 in US summer time, UTC+2 otherwise), the same clock the charts' time axis uses
  const zone = serverZone();
  // silence is the healthy state: words only when the feed is simulated, still connecting, or behind
  const warn = mode === "sim" ? t("desk.st.simulated") : mode !== "live" ? t("desk.st.connecting") : ping !== null && ping >= 150 ? t("desk.st.latency", { ms: ping }) : null;
  return (
    <div className="flex shrink-0 items-center gap-2 text-[12px] text-fg-3">
      <Tip content={`${T.account.server} · ${t("desk.st.latencyTip", { qps })}${ping === null ? "" : ` · ${t("desk.st.latency", { ms: ping })}`} · ${st.time} ${zone}`} side="top">
        <div className="flex h-6 items-center gap-1.5 px-1" tabIndex={0}>
          <span className={cn("size-1.5 rounded-full", ok ? "bg-up shadow-[0_0_6px_var(--k-up)]" : mode === "sim" ? "bg-warn" : "bg-warn animate-pulse")} aria-hidden />
          {warn && <span className="whitespace-nowrap text-warn">{warn}</span>}
        </div>
      </Tip>
      {T.engine && <TradeServerCell />}
    </div>
  );
}

/** Live builds: the account stream to the trading engine (positions, orders, equity). */
function TradeServerCell() {
  const T = useTerminal();
  const t = useT();
  const st = useStreamStatus();
  // the account stream is one of the two things the dot beside it promises; it speaks only when that promise breaks
  if (st.s === "open") return null;
  const text = st.s === "reconnecting" ? `${t("trader.status.reconnecting")}${st.attempt > 1 ? ` (${st.attempt})` : ""}` : st.s === "connecting" ? t("trader.status.connecting") : t("trader.status.tradeServerOffline");
  return (
    <Tip content={t("trader.status.streamDown")} side="top">
      <div className="flex h-6 items-center gap-1.5 whitespace-nowrap" tabIndex={0}>
        <span className="size-1.5 rounded-full bg-warn" aria-hidden />
        <span className="text-warn">{text}</span>
      </div>
    </Tip>
  );
}

/** "Positions (3) ↓": full page, scrolls down to the positions; split, shows or hides the panel under the chart. */
function PositionsCue() {
  const T = useTerminal();
  const t = useT();
  const { primary } = useActivityTabs();
  const first = primary[0]!;
  const split = T.ws.posLayout === "split";
  const shown = T.ws.panels.toolbox;
  return (
    <Tip content={split ? t("desk.pl.toggleTip") : t("desk.act.scrollTip")} shortcut="Ctrl+T" side="top">
      <button
        onClick={() => (split ? T.togglePanel("toolbox") : scrollToActivity())}
        aria-expanded={split ? shown : undefined}
        data-tour="activity"
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border border-line bg-panel-2/70 px-2.5 text-[12.5px] font-semibold text-fg transition-colors hover:border-ember/40 hover:bg-ember-soft/40"
      >
        {first.label}
        {first.count ? <CountBadge n={first.count} tone="accent" /> : null}
        {split ? shown ? <ChevronDown className="size-3.5 text-accent-text" /> : <ChevronUp className="size-3.5 text-accent-text" /> : <ArrowDown className="size-3.5 text-accent-text" />}
      </button>
    </Tip>
  );
}

export function ScreenBar() {
  return (
    <div className="t-glass flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-[12px] border border-line pe-1.5">
      <AccountHealth className="min-w-0 flex-1" />
      <Connection />
      <PositionsCue />
    </div>
  );
}
