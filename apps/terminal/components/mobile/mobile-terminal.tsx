"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowUpRight, BarChart2, CandlestickChart, History, List, LogOut, Moon, RefreshCw, Search, Sun, UserRound, Wallet, X, Zap } from "lucide-react";
import { INSTRUMENTS, getInstrument } from "@kalks/mock";
import { LogoMark, PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useMetrics, useTerminal } from "@/lib/store";
import { useMarketOpen } from "@/lib/market-hours";
import { PENDING_LABEL, TIMEFRAMES, accCcy, accMoney, fmtPrice, fmtServer, fmtVol, profitUsd } from "@/lib/trading";
import { Badge, LiveMoney, MiniSwitch, Pnl, Stepper } from "@/components/ui/primitives";
import { ChartView } from "@/components/chart/chart-view";
import { CLIENT_AREA } from "@/components/shell/title-bar";

type MTab = "watch" | "chart" | "trade" | "history" | "account";

/** cTrader-mobile-like layout for < 1024px: content + bottom tab bar. */
export function MobileTerminal() {
  const T = useTerminal();
  const [tab, setTab] = React.useState<MTab>("chart");
  const a = T.account;
  const m = useMetrics();
  const tabs: { id: MTab; label: string; icon: React.ReactNode }[] = [
    { id: "watch", label: "Watchlist", icon: <List /> },
    { id: "chart", label: "Chart", icon: <CandlestickChart /> },
    { id: "trade", label: "Trade", icon: <BarChart2 /> },
    { id: "history", label: "History", icon: <History /> },
    { id: "account", label: "Account", icon: <UserRound /> },
  ];
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page">
      <header className="t-titlebar-glow flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
        <span className="grid size-7 place-items-center rounded-[7px] border border-line-top bg-surface-3">
          <LogoMark size={12} className="text-fg" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <span className="font-mono">{a.login}</span>
            <Badge tone={a.type === "live" ? "ember" : "gold"}>{a.type}</Badge>
            {T.readOnly && <Badge tone="warn">Read-only</Badge>}
          </div>
          <div className="truncate text-[10.5px] text-fg-3">
            {a.group} · {a.mode} · {a.server}
          </div>
        </div>
        <div className="ml-auto text-right leading-tight">
          <div className="font-mono text-[13px] font-semibold"><LiveMoney value={m.equity} format={(v) => accMoney(a, v)} /></div>
          <div className="font-mono text-[10.5px]">
            <Pnl value={m.floating} text={accMoney(a, m.floating, { signed: true })} format={(v) => accMoney(a, v, { signed: true })} /> <span className="text-fg-3">{accCcy(a)}</span>
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "watch" && <MWatch onPick={() => setTab("chart")} />}
        {tab === "chart" && <MChart />}
        {tab === "trade" && <MTrade />}
        {tab === "history" && <MHistory />}
        {tab === "account" && <MAccount />}
      </main>
      <nav className="grid h-[58px] shrink-0 grid-cols-5 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("relative flex flex-col items-center justify-center gap-0.5 text-[10.5px] [&_svg]:size-[18px]", tab === t.id ? "text-ember" : "text-fg-3")}>
            {tab === t.id && <span className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-ember" />}
            {t.icon}
            {t.label}
            {t.id === "trade" && T.positions.length > 0 && <span className="absolute right-[22%] top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-ember px-1 font-mono text-[9px] text-white">{T.positions.length}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function MWatch({ onPick }: { onPick: () => void }) {
  const T = useTerminal();
  const [q, setQ] = React.useState("");
  const list = INSTRUMENTS.filter((i) => !q || i.symbol.toLowerCase().includes(q.toLowerCase()) || i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <label className="flex h-9 items-center gap-2 rounded-[8px] border border-line bg-surface-2 px-3">
          <Search className="size-4 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbols" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
        </label>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto">
        {list.map((i) => (
          <MWatchRow key={i.symbol} symbol={i.symbol} active={T.activeSymbol === i.symbol} onPick={() => (T.openSymbol(i.symbol), onPick())} />
        ))}
      </div>
    </div>
  );
}

function MWatchRow({ symbol, active, onPick }: { symbol: string; active: boolean; onPick: () => void }) {
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  return (
    <button onClick={onPick} className={cn("flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2 text-left", active && "bg-ember-soft/50")}>
      <SymbolAvatar symbol={symbol} size={22} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{symbol}</div>
        <div className={cn("k-num font-mono text-[10.5px]", q.change >= 0 ? "text-up" : "text-down")}>
          {q.change >= 0 ? "+" : ""}
          {q.change.toFixed(2)}% <span className="font-sans text-fg-3">· {inst.name}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <span className="min-w-[78px] rounded-[5px] bg-down-soft px-1.5 py-1 text-right">
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} pulse className="justify-end px-0.5 text-[12px]" />
        </span>
        <span className="min-w-[78px] rounded-[5px] bg-up-soft px-1.5 py-1 text-right">
          <PriceText symbol={symbol} value={q.ask} dir={q.dir} pulse className="justify-end px-0.5 text-[12px]" />
        </span>
      </div>
    </button>
  );
}

function MChart() {
  const T = useTerminal();
  const tab = T.activeTab;
  const q = useQuote(tab.symbol);
  const [vol, setVol] = React.useState(T.ws.lot.toFixed(2));
  const v = Math.max(0.01, parseFloat(vol) || 0.01);
  const marketOpen = useMarketOpen(tab.symbol);
  const trade = (side: "buy" | "sell") => {
    if (!marketOpen) return;
    if (T.ws.oneClick) T.quickTrade(tab.symbol, side, v);
    else T.openNewOrder({ symbol: tab.symbol, side, type: "market" });
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 [scrollbar-width:none]">
        <button onClick={() => T.setUi({ search: true })} className="flex h-7 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[12.5px] font-semibold">
          <SymbolAvatar symbol={tab.symbol} size={14} /> {tab.symbol}
        </button>
        <span className="h-4 w-px shrink-0 bg-line" />
        {TIMEFRAMES.map((tf) => (
          <button key={tf} onClick={() => T.updateTab(tab.id, { tf })} className={cn("h-7 shrink-0 rounded-[5px] px-2 font-mono text-[11px]", tab.tf === tf ? "bg-ember-soft text-ember" : "text-fg-3")}>
            {tf}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 p-1">
        <ChartView tab={tab} active={false} onActivate={() => {}} compact hideOneClick />
      </div>
      {!T.readOnly && (
        <div className="grid shrink-0 grid-cols-[1fr_110px_1fr] gap-1.5 border-t border-line bg-panel p-2">
          <button onClick={() => trade("sell")} disabled={!marketOpen} className="rounded-[8px] bg-down px-2 py-1.5 text-left text-white disabled:bg-surface-3 disabled:text-fg-3 [&:disabled_span]:!text-fg-3">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] opacity-85">Sell</div>
            <PriceText symbol={tab.symbol} value={q.bid} dir={q.dir} className="text-[15px] [&_span]:!text-white" />
          </button>
          <div className="flex flex-col justify-center gap-1">
            <Stepper ariaLabel="Volume" value={vol} onChange={setVol} step={0.01} min={0.01} decimals={2} className="h-8" />
            <div className={cn("text-center font-mono text-[9.5px]", marketOpen ? "text-fg-3" : "text-warn")}>{!marketOpen ? "market closed" : T.ws.oneClick ? "one-click" : "confirm"}</div>
          </div>
          <button onClick={() => trade("buy")} disabled={!marketOpen} className="rounded-[8px] bg-up px-2 py-1.5 text-right text-white disabled:bg-surface-3 disabled:text-fg-3 [&:disabled_span]:!text-fg-3">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] opacity-85">Buy</div>
            <PriceText symbol={tab.symbol} value={q.ask} dir={q.dir} className="justify-end text-[15px] [&_span]:!text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

function MTrade() {
  const T = useTerminal();
  const m = useMetrics();
  const a = T.account;
  return (
    <div className="t-scroll h-full overflow-y-auto">
      <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
        {[
          ["Balance", accMoney(a, m.balance)],
          ["Equity", accMoney(a, m.equity)],
          ["Free margin", accMoney(a, m.free)],
          ["Margin", accMoney(a, m.margin)],
          ["Level", Number.isFinite(m.level) ? `${m.level.toFixed(0)}%` : "—"],
          ["P&L", accMoney(a, m.floating, { signed: true })],
        ].map(([k, v]) => (
          <div key={k} className="bg-panel px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.06em] text-fg-3">{k}</div>
            <div className={cn("k-num font-mono text-[12.5px]", k === "P&L" && (m.floating >= 0 ? "text-up" : "text-down"))}>{v}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
        Positions ({T.positions.length})
        {!T.readOnly && T.positions.length > 0 && (
          <button onClick={() => T.bulkClose("all")} className="rounded-[5px] border border-line px-2 py-0.5 text-[10.5px] normal-case tracking-normal text-down">
            Close all
          </button>
        )}
      </div>
      {T.positions.map((p) => (
        <MPosition key={p.ticket} ticket={p.ticket} />
      ))}
      {!T.positions.length && <div className="px-3 py-4 text-center text-[12px] text-fg-3">No open positions</div>}
      <div className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">Pending orders ({T.pendings.length})</div>
      {T.pendings.map((o) => (
        <div key={o.ticket} className="flex items-center gap-2.5 border-b border-line/60 px-3 py-2">
          <SymbolAvatar symbol={o.symbol} size={18} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">
              {o.symbol} <span className={o.side === "buy" ? "text-up" : "text-down"}>{PENDING_LABEL(o)}</span>
            </div>
            <div className="font-mono text-[10.5px] text-fg-3">
              {fmtVol(o.volume)} at {fmtPrice(o.symbol, o.price)} · {o.expiry}
            </div>
          </div>
          {!T.readOnly && (
            <button onClick={() => T.cancelPending(o.ticket)} className="grid size-7 place-items-center rounded-[6px] border border-line text-fg-3" aria-label="Cancel order">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MPosition({ ticket }: { ticket: string }) {
  const T = useTerminal();
  const p = T.positions.find((x) => x.ticket === ticket)!;
  const q = useQuote(p.symbol);
  const pr = profitUsd(p, q.bid, q.ask);
  return (
    <div className="flex items-center gap-2.5 border-b border-line/60 px-3 py-2" onClick={() => !T.readOnly && T.setUi({ positionDialog: p.ticket })}>
      <SymbolAvatar symbol={p.symbol} size={20} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium">
          {p.symbol} <span className={p.side === "buy" ? "text-up" : "text-down"}>{p.side}</span> <span className="font-mono text-fg-2">{fmtVol(p.volume)}</span>
        </div>
        <div className="font-mono text-[10.5px] text-fg-3">
          {fmtPrice(p.symbol, p.openPrice)} → {fmtPrice(p.symbol, p.side === "buy" ? q.bid : q.ask)}
        </div>
      </div>
      <Pnl value={pr} text={accMoney(T.account, pr, { signed: true })} format={(v) => accMoney(T.account, v, { signed: true })} arrow className="text-[13px] font-semibold" />
      {!T.readOnly && (
        <button onClick={(e) => (e.stopPropagation(), T.closePosition(p.ticket))} className="grid size-7 place-items-center rounded-[6px] border border-line text-fg-3" aria-label="Close position">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function MHistory() {
  const T = useTerminal();
  const rows = T.history.slice(0, 80);
  return (
    <div className="t-scroll h-full overflow-y-auto">
      {rows.map((h) => (
        <div key={`${h.ticket}-${h.closeTime}`} className="flex items-center gap-2.5 border-b border-line/60 px-3 py-2">
          <SymbolAvatar symbol={h.symbol} size={18} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">
              {h.symbol} <span className={h.side === "buy" ? "text-up" : "text-down"}>{h.side}</span> <span className="font-mono text-fg-2">{fmtVol(h.volume)}</span>
            </div>
            <div className="truncate font-mono text-[10.5px] text-fg-3">
              {fmtServer(h.closeTime, false)} · {fmtPrice(h.symbol, h.openPrice)} → {fmtPrice(h.symbol, h.closePrice)}
            </div>
          </div>
          <Pnl value={h.profit} text={accMoney(T.account, h.profit, { signed: true })} className="text-[12.5px] font-semibold" />
        </div>
      ))}
    </div>
  );
}

function MAccount() {
  const T = useTerminal();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="t-scroll h-full space-y-3 overflow-y-auto p-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">Accounts</div>
      <div className="overflow-hidden rounded-[8px] border border-line bg-panel">
        {T.accounts.map((x) => (
          <MAccountRow key={x.login} login={x.login} />
        ))}
      </div>
      <div className="overflow-hidden rounded-[8px] border border-line bg-panel">
        <Row label="One-click trading" icon={<Zap />}>
          <MiniSwitch checked={T.ws.oneClick} onChange={(v) => T.setWs({ oneClick: v })} label="One-click trading" />
        </Row>
        <Row label="Sound on fills">
          <MiniSwitch checked={T.ws.sound} onChange={(v) => T.setWs({ sound: v })} label="Sound" />
        </Row>
        <Row label="Dark theme" icon={resolvedTheme === "light" ? <Sun /> : <Moon />}>
          <MiniSwitch checked={resolvedTheme !== "light"} onChange={(v) => setTheme(v ? "dark" : "light")} label="Theme" />
        </Row>
        {T.account.type === "demo" && (
          <Row label={`Refill demo (${T.refillsLeft} left)`} icon={<RefreshCw />}>
            <button onClick={T.refillDemo} className="rounded-[5px] border border-gold/40 px-2 py-0.5 text-[11px] text-gold">
              Refill
            </button>
          </Row>
        )}
      </div>
      <a href={CLIENT_AREA} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-line bg-panel text-[13px]">
        <Wallet className="size-4" /> Client Area <ArrowUpRight className="size-3.5" />
      </a>
      <button onClick={() => (toast("Logged out"), T.logout())} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-down/30 bg-down-soft text-[13px] text-down">
        <LogOut className="size-4" /> Log out
      </button>
    </div>
  );
}

function MAccountRow({ login }: { login: string }) {
  const T = useTerminal();
  const m = useMetrics(login);
  const a = m.account;
  const on = login === T.account.login;
  return (
    <button onClick={() => T.switchAccount(login)} className={cn("flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2.5 text-left last:border-b-0", on && "bg-ember-soft/50")}>
      <Badge tone={a.type === "live" ? "ember" : "gold"} className="w-11 justify-center">
        {a.type}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12.5px]">{a.login}</div>
        <div className="text-[10.5px] text-fg-3">
          {a.group} · {a.mode} · 1:{a.leverage}
        </div>
      </div>
      <div className="text-right font-mono text-[12px]">
        {accMoney(a, m.equity)} <span className="text-[10px] text-fg-3">{accCcy(a)}</span>
      </div>
    </button>
  );
}

function Row({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-11 items-center gap-2.5 border-b border-line/60 px-3 last:border-b-0">
      <span className="text-fg-3 [&>svg]:size-4">{icon}</span>
      <span className="flex-1 text-[13px]">{label}</span>
      {children}
    </div>
  );
}
