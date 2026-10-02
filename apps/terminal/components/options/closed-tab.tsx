"use client";

// Toolbox › Closed (Options mode) and the phone's Positions › Closed: closed option trades, one row each, in plain
// words: "Bought at $16.25 · sold at $14.10" (per contract), "Settled at 1.1712 → you received $120.00" for an expiry,
// the net P&L (commission included) and its % of the premium, why it closed (closed by you, expired, stop loss,
// stop-out…), when, and a Share button. Every exit deal of an option position: a manual close (through the book or
// at the house price), a stop-out or liquidation, an expiry settlement, a knock-out. The engine state carries the
// latest deals; live sessions also load the engine's history of the period.
import * as React from "react";
import { History, RefreshCw } from "lucide-react";
import { OPTION_SPEC } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { fmtServer } from "@/lib/trading";
import { Pnl } from "@/components/ui/primitives";
import { loadOptionHistory, useOptionBook, type OptClosed } from "@/lib/options/book";
import { useOptionsAttach } from "@/lib/options-store";
import { OptAvatar } from "./bits";
import { OptionShareButton } from "@/components/share/option-share";
import { expiryLabel, iso, money, moneySigned, pctSigned, strikeOf } from "./format";
import { useSettledText } from "./settlements-tab";

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
  bust: "bg-warn-soft text-warn",
  sl: "bg-down-soft text-down",
  tp: "bg-up-soft text-up",
  dealer: "bg-gold-soft text-gold",
  other: "bg-surface-3 text-fg-3",
};

/** Why it closed, as a small chip. */
export function CloseReason({ o }: { o: OptClosed }) {
  const t = useT();
  return <span className={cn("inline-flex h-[18px] shrink-0 items-center rounded-[5px] px-1.5 text-[10px] font-semibold", REASON_TONE[o.reason])}>{t.dyn(`trader.opt.hist.reason.${o.reason}`, o.rawReason || o.reason)}</span>;
}

const digitsOfU = (u: string) => OPTION_SPEC[u]?.digits ?? 5;

/** The trade in one plain sentence (per-contract prices, or how it settled). */
function useClosedText() {
  const t = useT();
  const settled = useSettledText();
  return React.useCallback(
    (o: OptClosed) => {
      const open = o.usdPerUnit > 0 ? money(o.openPrice * o.usdPerUnit) : "—";
      const close = o.usdPerUnit > 0 ? money(o.closePrice * o.usdPerUnit) : "—";
      if (o.reason === "expired") {
        const k = o.side === "buy" ? 1 : -1;
        const payout = o.usdPerUnit > 0 ? k * o.closePrice * o.usdPerUnit * o.contracts : 0;
        return settled({ fixing: o.fixing ?? null, payout, side: o.side }, digitsOfU(o.option.underlying));
      }
      // risk control and dealing-desk corrections in plain words
      if (o.reason === "bust") return t("trader.opt.hist.closedBust", iso({ close }));
      if (o.reason === "liquidation" && o.fillKind === "backstop") return t("trader.opt.hist.closedBackstop", iso({ close }));
      if (o.reason === "liquidation" || o.reason === "stop_out") return t("trader.opt.hist.closedRisk", iso({ close }));
      return o.side === "buy" ? t("trader.opt.hist.boughtSold", iso({ open, close })) : t("trader.opt.hist.soldBought", iso({ open, close }));
    },
    [t, settled],
  );
}

function ClosedRow({ o, locale }: { o: OptClosed; locale: string }) {
  const t = useT();
  const text = useClosedText();
  const u = o.option.underlying;
  const basis = o.usdPerUnit > 0 ? o.openPrice * o.usdPerUnit * o.contracts : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[12px] border border-line bg-panel-2/70 px-3 py-2.5">
      <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
        <OptAvatar symbol={u} size={20} />
        <div className="min-w-0 leading-tight" title={o.option.series}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12.5px] font-semibold text-fg">{u}</span>
            <span className={cn("rounded-[4px] px-1 text-[10px] font-semibold", o.option.right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{o.option.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}</span>
            <span className="font-mono text-[12px] font-semibold text-fg">{strikeOf(o.option, digitsOfU(u))}</span>
            <span className={cn("rounded-[4px] px-1 text-[10px] font-semibold", o.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
              {o.side === "buy" ? t("trader.opt.pos.bought") : t("trader.opt.pos.sold")} ×{o.contracts}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-fg-3">
            {o.option.expiry ? expiryLabel(o.option.expiry, locale) : ""} · #{o.ticket}
          </div>
        </div>
      </div>
      <div className="min-w-[200px] flex-[1.4] text-[12px] leading-snug text-fg-2" dir="auto">
        {text(o)}
        {o.commission > 0 && <span className="text-fg-3"> · {t("trader.opt.hist.fee", iso({ amount: money(o.commission) }))}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex flex-col items-end leading-tight">
          <span className="text-[13.5px] font-semibold">
            <Pnl value={o.profit} text={moneySigned(o.profit)} />
          </span>
          {basis > 0 && <span className={cn("k-num font-mono text-[10.5px]", o.profit > 0 ? "text-up" : o.profit < 0 ? "text-down" : "text-fg-3")}>{pctSigned(o.profit / basis)}</span>}
        </span>
        <span className="flex flex-col items-end gap-1 leading-tight">
          <CloseReason o={o} />
          <span className="font-mono text-[10.5px] text-fg-3">{o.closeTime ? fmtServer(o.closeTime, false) : "—"}</span>
        </span>
        <OptionShareButton o={o} />
      </div>
    </div>
  );
}

function useHistory(days: number) {
  const T = useTerminal();
  const login = T.guest ? null : T.account.login;
  const closed = useOptionBook(login).closed;
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    if (!login || !T.engine) return;
    setBusy(true);
    await loadOptionHistory(login, !!T.account.cent, Math.min(365, Math.max(30, days)));
    setBusy(false);
  }, [login, T.engine, T.account.cent, days]);
  React.useEffect(() => {
    void load();
  }, [load]);
  return { closed, busy, load, engine: T.engine };
}

export function ClosedTab() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  const [period, setPeriod] = React.useState<Period>("month");
  const days = PERIODS.find((p) => p.value === period)!.days;
  const { closed, busy, load, engine } = useHistory(days);

  const now = Date.now();
  const since = period === "today" ? new Date(new Date(now + 3 * 3600e3).toISOString().slice(0, 10) + "T00:00:00Z").getTime() - 3 * 3600e3 : now - days * 86_400_000;
  const rows = closed.filter((o) => Date.parse(o.closeTime) >= since);
  const net = rows.reduce((s, o) => s + o.profit, 0);
  const wins = rows.filter((o) => o.profit > 0).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-2.5">
        <div className="flex items-center gap-0.5 rounded-[8px] border border-line bg-surface-2 p-0.5">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} aria-pressed={period === p.value} className={cn("h-6 rounded-[6px] px-2 text-[11px] font-medium", period === p.value ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--k-border-top)]" : "text-fg-3 hover:text-fg-2")}>
              {t(p.key)}
            </button>
          ))}
        </div>
        <span className="ms-auto flex items-center gap-4 text-[11.5px] text-fg-3">
          <span>
            {t("toolbox.history.trades")} <span className="font-mono text-fg">{rows.length}</span>
          </span>
          <span>
            {t("toolbox.history.winRate")} <span dir="ltr" className="font-mono text-fg">{rows.length ? ((wins / rows.length) * 100).toFixed(0) : "0"}%</span>
          </span>
          {rows.length > 0 && (
            <span className="flex items-baseline gap-1">
              {t("trader.opt.col.pnl")}
              <span className="text-[12.5px] font-semibold">
                <Pnl value={net} text={moneySigned(net)} />
              </span>
            </span>
          )}
          {engine && (
            <button onClick={() => void load()} disabled={busy} title={t("trader.opt.ord.refresh")} aria-label={t("trader.opt.ord.refresh")} className="grid size-7 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-50">
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
            </button>
          )}
        </span>
      </div>
      <div className="t-scroll min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
        {rows.slice(0, 500).map((o) => (
          <ClosedRow key={o.deal} o={o} locale={locale} />
        ))}
        {!rows.length && <EmptyClosed />}
      </div>
    </div>
  );
}

function EmptyClosed() {
  const t = useT();
  return (
    <div className="grid h-full min-h-32 place-items-center p-4 text-center">
      <div className="max-w-[360px]">
        <div className="mx-auto mb-2 grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
          <History className="size-4" />
        </div>
        <div className="text-[13px] font-semibold text-fg">{t("trader.opt.hist.empty")}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-fg-3">{t("trader.opt.hist.emptySub")}</p>
      </div>
    </div>
  );
}

/** Closed trades on phones (the same rows, the last 90 days). */
export function ClosedList() {
  const { locale } = useLocale();
  const { closed } = useHistory(90);
  return (
    <div className="t-scroll h-full space-y-1.5 overflow-y-auto p-2">
      {closed.slice(0, 200).map((o) => (
        <ClosedRow key={o.deal} o={o} locale={locale} />
      ))}
      {!closed.length && <EmptyClosed />}
    </div>
  );
}
