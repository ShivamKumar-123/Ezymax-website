"use client";

import * as React from "react";
import { Cpu, Gauge, HelpCircle, LayoutTemplate } from "lucide-react";
import { priceFeed } from "@kalks/mock";
import { cn, useFeedMode } from "@kalks/ui";
import { Pnl } from "@/components/ui/primitives";
import { useMetrics, useTerminal } from "@/lib/store";
import { useQps } from "@/lib/market";
import { accCcy, accMoney, serverTime } from "@/lib/trading";

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
        <span className={cn("size-1.5 rounded-full", ok ? "t-live-dot bg-up" : "bg-warn")} />
        <span className="font-sans text-fg-2">{mode === "live" ? "Connected" : mode === "sim" ? "Price feed offline · simulated" : "Connecting"}</span>
        <span>· {a.server} ·</span>
        <span title="Quote latency (p95): market-data service → this terminal" className={cn("k-num w-[38px]", ok ? "text-fg-2" : "text-warn")}>{ping === null ? "—" : `${ping} ms`}</span>
      </Cell>
      <Cell title="Workspace profile">
        <LayoutTemplate className="size-3" />
        <span className="font-sans">{T.ws.profile}</span>
      </Cell>
      <Cell title="Quotes per second">
        <span className="k-num w-[46px] text-fg-2">{qps} q/s</span>
      </Cell>
      <Cell title="Account currency">
        <span className="text-fg-2">{accCcy(a)}</span>
        <span>· 1:{a.leverage}</span>
      </Cell>
      <Cell className="hidden lg:flex" title="Floating P&L">
        <span className="font-sans">P&L</span>
        <Pnl value={m.floating} text={accMoney(a, m.floating, { signed: true })} format={(v) => accMoney(a, v, { signed: true })} className="px-0.5" />
      </Cell>
      <Cell className="hidden xl:flex" title="Margin level">
        <Gauge className="size-3" />
        <span className={cn("k-num", lvl !== null && lvl < 200 ? "text-warn" : "text-fg-2")}>{lvl === null ? "—" : `${lvl.toFixed(0)}%`}</span>
      </Cell>
      {T.ws.oneClick && !T.readOnly && (
        <Cell className="hidden xl:flex">
          <span className="font-sans text-ember">One-click ON</span>
        </Cell>
      )}
      <div className="ml-auto flex items-center">
        <Cell title="Server time (GMT+3)">
          <span className="k-num text-fg-2">
            {st.date} {st.time}
          </span>
          <span>GMT+3</span>
        </Cell>
        <Cell title="Terminal load">
          <Cpu className="size-3" />
          <span className="flex h-2 w-12 items-end gap-px">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={cn("flex-1 rounded-[1px]", i < Math.ceil(cpu / 10) ? (cpu > 25 ? "bg-warn" : "bg-up/80") : "bg-surface-3")} style={{ height: `${40 + i * 6}%` }} />
            ))}
          </span>
          <span className="k-num w-6 text-fg-2">{cpu}%</span>
        </Cell>
        <button onClick={() => T.setUi({ shortcuts: true })} className="flex h-[26px] items-center gap-1 px-2 font-sans hover:text-fg">
          <HelpCircle className="size-3" /> Help: F1
        </button>
      </div>
    </footer>
  );
}

function Cell({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div title={title} className={cn("flex h-[26px] shrink-0 items-center gap-1.5 border-r border-line px-2 last:border-r-0", className)}>
      {children}
    </div>
  );
}
