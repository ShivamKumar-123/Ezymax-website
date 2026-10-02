"use client";

// Toolbox › Closed (Options mode): closed option trades. Every exit deal of an option position: a manual close
// (through the book or at the house price), a stop-out or liquidation, an expiry settlement, a knock-out. Shows the
// series, the side and contracts, the open and close premium in USD per contract, the commission, the P&L and why it
// closed. The engine state carries the latest deals; live sessions also load the engine's history of the period.
import * as React from "react";
import { History, RefreshCw } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { fmtServer } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { Empty, Pnl } from "@/components/ui/primitives";
import { loadOptionHistory, useOptionBook, type OptClosed } from "@/lib/options/book";
import { useOptionsAttach } from "@/lib/options-store";
import { OptAvatar, RightTag, SideTag } from "./bits";
import { expiryLabel, strikeText, usd, usdSigned } from "./format";

const PERIODS = [
  { value: "today", key: "toolbox.history.period.today", days: 1 },
  { value: "week", key: "toolbox.history.period.week", days: 7 },
  { value: "month", key: "toolbox.history.period.month", days: 30 },
  { value: "3m", key: "toolbox.history.period.3m", days: 90 },
  { value: "all", key: "toolbox.history.period.all", days: 3650 },
] as const;
type Period = (typeof PERIODS)[number]["value"];

const REASON_TONE: Record<OptClosed["reason"], string> = {
  closed: "bg-surface-3 text-fg-2",
  expired: "bg-info-soft text-info",
  knocked_out: "bg-warn-soft text-warn",
  stop_out: "bg-down-soft text-down",
  liquidation: "bg-down-soft text-down",
  sl: "bg-down-soft text-down",
  tp: "bg-up-soft text-up",
  dealer: "bg-gold-soft text-gold",
  other: "bg-surface-3 text-fg-3",
};

/** Why it closed, as a small chip. */
export function CloseReason({ o }: { o: OptClosed }) {
  const t = useT();
  return <span className={cn("inline-flex h-[17px] items-center rounded-[4px] px-1.5 text-[10px] font-semibold", REASON_TONE[o.reason])}>{t.dyn(`trader.opt.hist.reason.${o.reason}`, o.rawReason || o.reason)}</span>;
}

export function ClosedTab() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  const login = T.guest ? null : T.account.login;
  const closed = useOptionBook(login).closed;
  const [period, setPeriod] = React.useState<Period>("month");
  const [busy, setBusy] = React.useState(false);
  const days = PERIODS.find((p) => p.value === period)!.days;
  const load = React.useCallback(async () => {
    if (!login || !T.engine) return;
    setBusy(true);
    await loadOptionHistory(login, !!T.account.cent, Math.min(365, Math.max(30, days)));
    setBusy(false);
  }, [login, T.engine, T.account.cent, days]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const since = period === "today" ? new Date(new Date(now + 3 * 3600e3).toISOString().slice(0, 10) + "T00:00:00Z").getTime() - 3 * 3600e3 : now - days * 86_400_000;
  const rows = closed.filter((o) => Date.parse(o.closeTime) >= since);
  const net = rows.reduce((s, o) => s + o.profit, 0);
  const fees = rows.reduce((s, o) => s + o.commission, 0);
  const wins = rows.filter((o) => o.profit > 0).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        <div className="flex items-center gap-0.5">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={cn("h-6 rounded-[5px] px-2 text-[11px]", period === p.value ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
              {t(p.key)}
            </button>
          ))}
        </div>
        <span className="ms-auto flex items-center gap-3 font-mono text-[11px] text-fg-3">
          <span>
            {t("toolbox.history.trades")} <span className="text-fg">{rows.length}</span>
          </span>
          <span>
            {t("toolbox.history.winRate")} <span dir="ltr" className="text-fg">{rows.length ? ((wins / rows.length) * 100).toFixed(1) : "0.0"}%</span>
          </span>
          {T.engine && (
            <button onClick={() => void load()} disabled={busy} title={t("trader.opt.ord.refresh")} className="grid size-6 place-items-center rounded-[5px] text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-50">
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
            </button>
          )}
        </span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0">
          <thead>
            <tr>
              <Th className="ps-3">{t("trader.opt.col.series")}</Th>
              <Th>{t("toolbox.col.ticket")}</Th>
              <Th>{t("trader.opt.col.side")}</Th>
              <Th right>{t("trader.opt.ticket.contracts")}</Th>
              <Th right>{t("trader.opt.col.openPremium")}</Th>
              <Th right>{t("trader.opt.hist.closePremium")}</Th>
              <Th right>{t("toolbox.col.commission")}</Th>
              <Th right>{t("trader.opt.col.pnl")}</Th>
              <Th>{t("toolbox.col.reason")}</Th>
              <Th>{t("toolbox.col.openTime")}</Th>
              <Th className="pe-3">{t("toolbox.col.closeTime")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((o) => (
              <tr key={o.deal} className="hover:bg-surface-2/70">
                <Td className="ps-3">
                  <span className="flex items-center gap-1.5" title={o.option.series}>
                    <OptAvatar symbol={o.option.underlying} size={13} />
                    <span className="font-medium">{o.option.underlying}</span>
                    <span className="font-mono">{strikeText(o.option.strike, 6)}</span>
                    <RightTag right={o.option.right} />
                    <span className="text-[11px] text-fg-3">{o.option.expiry ? expiryLabel(o.option.expiry, locale, false) : ""}</span>
                  </span>
                </Td>
                <Td mono className="text-fg-3">
                  {o.ticket}
                </Td>
                <Td>
                  <SideTag side={o.side} />
                </Td>
                <Td right mono>
                  {o.contracts}
                </Td>
                <Td right mono className="text-fg-2">
                  {o.usdPerUnit > 0 ? usd(o.openPrice * o.usdPerUnit) : "—"}
                </Td>
                <Td right mono className="text-fg-2">
                  {o.usdPerUnit > 0 ? usd(o.closePrice * o.usdPerUnit) : "—"}
                </Td>
                <Td right mono className="text-fg-3">
                  {o.commission ? usd(-o.commission) : "0.00"}
                </Td>
                <Td right className="font-semibold">
                  <Pnl value={o.profit} text={usdSigned(o.profit)} />
                </Td>
                <Td>
                  <CloseReason o={o} />
                </Td>
                <Td mono className="text-fg-3">
                  {o.openTime ? fmtServer(o.openTime) : "—"}
                </Td>
                <Td mono className="pe-3 text-fg-3">
                  {o.closeTime ? fmtServer(o.closeTime) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="[&>td]:sticky [&>td]:bottom-0 [&>td]:border-t [&>td]:border-line [&>td]:bg-panel-2">
                <td colSpan={6} className="h-[28px] ps-3 text-[11px] text-fg-3">
                  {t("trader.opt.hist.premiumHint")}
                </td>
                <td className="px-2 text-end font-mono text-[12px] text-fg-2">{usd(-fees)}</td>
                <td className="px-2 text-end text-[12px] font-semibold">
                  <Pnl value={net} text={usdSigned(net)} />
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
        {!rows.length && <Empty icon={<History />} title={t("trader.opt.hist.empty")} sub={t("trader.opt.hist.emptySub")} />}
      </div>
    </div>
  );
}

/** Closed trades as cards (phones). */
export function ClosedList() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const login = T.guest ? null : T.account.login;
  const closed = useOptionBook(login).closed;
  React.useEffect(() => {
    if (login && T.engine) void loadOptionHistory(login, !!T.account.cent, 90);
  }, [login, T.engine, T.account.cent]);
  if (!closed.length) return <div className="p-8 text-center text-[12.5px] text-fg-3">{t("trader.opt.hist.empty")}</div>;
  return (
    <div className="t-scroll h-full space-y-1.5 overflow-y-auto p-2">
      {closed.slice(0, 200).map((o) => (
        <div key={o.deal} className="rounded-[9px] border border-line bg-panel p-2.5">
          <div className="flex items-center gap-2">
            <OptAvatar symbol={o.option.underlying} size={16} />
            <span className="text-[13px] font-semibold">{o.option.underlying}</span>
            <span className="font-mono text-[12.5px]">{strikeText(o.option.strike, 6)}</span>
            <RightTag right={o.option.right} />
            <span className="text-[11px] text-fg-3">{o.option.expiry ? expiryLabel(o.option.expiry, locale, false) : ""}</span>
            <span className="ms-auto text-[14px] font-semibold">
              <Pnl value={o.profit} text={usdSigned(o.profit)} />
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-3">
            <SideTag side={o.side} />
            <span>× {o.contracts}</span>
            <span>
              {o.usdPerUnit > 0 ? usd(o.openPrice * o.usdPerUnit) : "—"} → {o.usdPerUnit > 0 ? usd(o.closePrice * o.usdPerUnit) : "—"}
            </span>
            <CloseReason o={o} />
            <span className="ms-auto">{o.closeTime ? fmtServer(o.closeTime, false) : ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
