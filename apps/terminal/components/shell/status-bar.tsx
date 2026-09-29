"use client";

import * as React from "react";
import { Cpu, Gauge, HelpCircle, LayoutTemplate } from "lucide-react";
import { priceFeed } from "@kalks/mock";
import { cn, useFeedMode } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { Pnl } from "@/components/ui/primitives";
import { useMetrics, useTerminal } from "@/lib/store";
import { useQps } from "@/lib/market";
import { accCcy, accMoney, serverTime } from "@/lib/trading";
import { LOGIN_URL } from "@/lib/guest";
import { useStreamStatus } from "@/lib/engine/live";

function useTicker(ms: number) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
  return n;
}

export function StatusBar() {
  const T = useTerminal();
  const t = useT();
  const m = useMetrics();
  const a = T.account;
  const qps = useQps();
  const tick = useTicker(1000);
  const mode = useFeedMode();
  // real feed latency: browser receive − market-data service receive, p95 of the last 500 quotes
  const lat = priceFeed().latency();
  const ping = lat.n ? lat.p95 : null;
  const ok = mode === "live" && (ping === null || ping < 150);
  const [cpu, setCpu] = React.useState(7);
  React.useEffect(() => {
    setCpu((c) => Math.max(3, Math.min(34, Math.round(c + (Math.random() - 0.5) * 6))));
  }, [tick]);
  const st = serverTime();
  const lvl = Number.isFinite(m.level) ? m.level : null;
  return (
    <footer className="flex h-[26px] shrink-0 items-center gap-0 overflow-hidden border-t border-line bg-panel px-1 font-mono text-[10.5px] text-fg-3">
      <Cell>
        <span className={cn("size-1.5 rounded-full", ok ? "bg-up" : "bg-warn")} />
        <span className="font-sans text-fg-2">{mode === "live" ? t("trader.status.connected") : mode === "sim" ? t("trader.status.feedSimulated") : t("trader.status.connecting")}</span>
        <span>· {a.server} ·</span>
        <span title={t("trader.status.latencyTitle")} className={cn("k-num w-[38px]", ok ? "text-fg-2" : "text-warn")}>{ping === null ? "—" : `${ping} ms`}</span>
      </Cell>
      <Cell title={t("trader.status.profileTitle")}>
        <LayoutTemplate className="size-3" />
        <span className="font-sans">{t.dyn(`trader.profile.${T.ws.profile.toLowerCase()}`, T.ws.profile)}</span>
      </Cell>
      <Cell title={t("trader.status.qpsTitle")}>
        <span className="k-num w-[46px] text-fg-2">{qps} q/s</span>
      </Cell>
      {T.engine && <TradeServerCell />}
      {T.guest ? (
        <Cell title={t("trader.guest.text")}>
          <span className="font-sans text-fg-2">{t("trader.guest.badge")}</span>
          <span className="font-sans">· {t("trader.status.noAccount")} ·</span>
          <a href={LOGIN_URL} className="font-sans text-ember hover:underline">
            {t("trader.guest.logIn")}
          </a>
        </Cell>
      ) : (
        <>
          <Cell title={t("trader.status.currencyTitle")}>
            <span className="text-fg-2">{accCcy(a)}</span>
            <span>· 1:{a.leverage}</span>
          </Cell>
          <Cell className="hidden lg:flex" title={t("trader.status.floatingPnl")}>
            <span className="font-sans">{t("trader.status.pnl")}</span>
            <Pnl value={m.floating} text={accMoney(a, m.floating, { signed: true })} format={(v) => accMoney(a, v, { signed: true })} className="px-0.5" />
          </Cell>
          <Cell className="hidden xl:flex" title={t("trader.status.marginLevel")}>
            <Gauge className="size-3" />
            <span className={cn("k-num", lvl !== null && lvl < 200 ? "text-warn" : "text-fg-2")}>{lvl === null ? "—" : `${lvl.toFixed(0)}%`}</span>
          </Cell>
        </>
      )}
      {T.ws.oneClick && !T.readOnly && !T.guest && (
        <Cell className="hidden xl:flex">
          <span className="font-sans text-ember">{t("trader.status.oneClickOn")}</span>
        </Cell>
      )}
      <div className="ms-auto flex items-center">
        <Cell title={t("trader.status.serverTime")}>
          <span className="k-num text-fg-2">
            {st.date} {st.time}
          </span>
          <span>GMT+3</span>
        </Cell>
        {!T.live && (
        <Cell title={t("trader.status.terminalLoad")}>
          <Cpu className="size-3" />
          <span className="flex h-2 w-12 items-end gap-px">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={cn("flex-1 rounded-[1px]", i < Math.ceil(cpu / 10) ? (cpu > 25 ? "bg-warn" : "bg-up/80") : "bg-surface-3")} style={{ height: `${40 + i * 6}%` }} />
            ))}
          </span>
          <span className="k-num w-6 text-fg-2">{cpu}%</span>
        </Cell>
        )}
        <button onClick={() => T.setUi({ shortcuts: true })} className="flex h-[26px] items-center gap-1 px-2 font-sans hover:text-fg">
          <HelpCircle className="size-3" /> {t("trader.status.help")}
        </button>
      </div>
    </footer>
  );
}

/** Live builds: the account stream to the trading engine (positions, orders, equity). */
function TradeServerCell() {
  const T = useTerminal();
  const t = useT();
  const st = useStreamStatus();
  const up = st.s === "open";
  const text = up ? t("trader.status.tradeServer") : st.s === "reconnecting" ? `${t("trader.status.reconnecting")}${st.attempt > 1 ? ` (${st.attempt})` : ""}` : st.s === "connecting" ? t("trader.status.connecting") : t("trader.status.tradeServerOffline");
  return (
    <Cell title={up ? t("trader.status.streamUp", { login: T.account.login, server: T.account.server }) : t("trader.status.streamDown")}>
      <span className={cn("size-1.5 rounded-full", up ? "bg-up" : "bg-warn")} />
      <span className={cn("font-sans", up ? "text-fg-2" : "text-warn")}>{text}</span>
    </Cell>
  );
}

function Cell({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div title={title} className={cn("flex h-[26px] shrink-0 items-center gap-1.5 border-e border-line px-2 last:border-e-0", className)}>
      {children}
    </div>
  );
}
