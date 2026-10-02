"use client";

// Toolbox › Settlements (and the phone's Positions › Settlements): how expired options settled, in plain words:
// "Settled at 1.1712 → you received $120.00" (or "you paid", or "expired worthless"), with the position's P&L, the
// settlement price being the average mid over the 30 minutes before the cut, and the run (run 2+ is a re-fix within
// the hour after the cut, plan O39; a reversed run is shown struck through and left out of the totals). The engine
// answers in the account's currency (USC on cent accounts): amounts are shown in USD like the rest of the workspace.
import * as React from "react";
import { CalendarCheck2, RefreshCw } from "lucide-react";
import { OPTION_SPEC, parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { fmtServer } from "@/lib/trading";
import { Pnl } from "@/components/ui/primitives";
import type { EngineErr } from "@/lib/engine/map";
import { engineUsd, optionsApi, isLaunchingSoon } from "@/lib/options/api";
import { errText } from "@/lib/options/errors";
import type { Settlement } from "@/lib/options/types";
import { OptAvatar, OptionsUnavailable } from "./bits";
import { Explain } from "./explain";
import { expiryLabel, iso, money, moneySigned, px } from "./format";

/** "Settled at 1.1712 → you received $120.00" for one settlement (amounts in USD). */
export function useSettledText() {
  const t = useT();
  return React.useCallback(
    (x: Pick<Settlement, "fixing" | "payout" | "side">, digits: number) => {
      if (x.fixing === null || x.fixing === undefined || !Number.isFinite(x.fixing)) return t("trader.opt.set.pending");
      const price = px(x.fixing, digits);
      if (x.payout > 0.004) return t("trader.opt.set.received", iso({ price, amount: money(x.payout) }));
      if (x.payout < -0.004) return t("trader.opt.set.paid", iso({ price, amount: money(-x.payout) }));
      return x.side === "sell" ? t("trader.opt.set.kept", iso({ price })) : t("trader.opt.set.worthless", iso({ price }));
    },
    [t],
  );
}

function Row({ x, locale }: { x: Settlement; locale: string }) {
  const t = useT();
  const text = useSettledText();
  const s = parseSeriesCode(x.series);
  const digits = s ? (OPTION_SPEC[s.underlying]?.digits ?? 5) : 5;
  const tone = x.payout > 0.004 ? "up" : x.payout < -0.004 ? "down" : "flat";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[12px] border border-line bg-panel-2/70 px-3 py-2.5", x.reversed && "opacity-55")}>
      <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", tone === "up" ? "bg-up-soft text-up" : tone === "down" ? "bg-down-soft text-down" : "bg-surface-3 text-fg-3")}>
          <CalendarCheck2 className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="flex flex-wrap items-center gap-1.5">
            {s && <OptAvatar symbol={s.underlying} size={14} />}
            <span className="text-[12.5px] font-semibold text-fg">{s?.underlying ?? x.series}</span>
            {s && (
              <>
                <span className={cn("rounded-[4px] px-1 text-[10px] font-semibold", s.right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{s.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}</span>
                <span className="font-mono text-[12px] font-semibold text-fg">{s.strikeLabel}</span>
              </>
            )}
            <span className={cn("rounded-[4px] px-1 text-[10px] font-semibold", x.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>
              {x.side === "buy" ? t("trader.opt.pos.bought") : t("trader.opt.pos.sold")} ×{x.contracts}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-fg-3">
            {s ? expiryLabel(s.date, locale) : ""} · #{x.ticket}
          </div>
        </div>
      </div>
      <div className={cn("min-w-[200px] flex-[1.4] text-[12.5px]", x.reversed ? "text-fg-3 line-through" : tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg-2")} dir="auto">
        {text(x, digits)}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {x.profit !== undefined && (
          <span className="flex flex-col items-end leading-tight">
            <span className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{t("trader.opt.col.pnl")}</span>
            <span className="text-[13px] font-semibold">
              <Pnl value={x.profit} text={moneySigned(x.profit)} />
            </span>
          </span>
        )}
        <span className="flex flex-col items-end leading-tight">
          {x.reversed ? <span className="rounded-[4px] bg-surface-3 px-1.5 text-[10px] font-semibold text-fg-3">{t("trader.opt.set.reversed")}</span> : x.run > 1 ? <span className="rounded-[4px] bg-warn-soft px-1.5 text-[10px] font-semibold text-warn">{t("trader.opt.set.rerun", { n: x.run })}</span> : null}
          <span className="font-mono text-[10.5px] text-fg-3">{fmtServer(x.at, false)}</span>
        </span>
      </div>
    </div>
  );
}

export function SettlementsTab() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const login = T.account.login;
  const cent = !!T.account.cent;
  const [items, setItems] = React.useState<Settlement[] | null>(null);
  const [err, setErr] = React.useState<EngineErr | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    const r = await optionsApi.settlements(login);
    setBusy(false);
    if (r.ok) {
      // the engine's money is in the account's currency: USD here
      const list = (r.data.items ?? []).map((x) => ({ ...x, payout: engineUsd(x.payout, cent) ?? 0, profit: engineUsd(x.profit, cent) }));
      setItems(list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)));
      setErr(null);
    } else setErr(r.err);
  }, [login, cent]);
  React.useEffect(() => {
    void load();
  }, [load]);

  if (err && isLaunchingSoon(err)) return <OptionsUnavailable kind="soon" compact onRetry={() => void load()} />;
  const live = (items ?? []).filter((x) => !x.reversed);
  const total = live.reduce((s, x) => s + x.payout, 0);
  const pnl = live.some((x) => x.profit !== undefined) ? live.reduce((s, x) => s + (x.profit ?? 0), 0) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-1.5 text-[11.5px]">
        <span className="flex min-w-0 flex-1 basis-[220px] items-center gap-1 text-fg-3">
          <span className="truncate">{t("trader.opt.set.twapShort")}</span> <Explain topic="expiry" size={11} />
        </span>
        {!!live.length && (
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-fg-3">{t("trader.opt.set.summary", { count: live.length })}</span>
            <span className="flex items-baseline gap-1">
              <span className="text-fg-3">{t("trader.opt.set.payout")}</span>
              <span className="font-semibold">
                <Pnl value={total} text={moneySigned(total)} />
              </span>
            </span>
            {pnl !== null && (
              <span className="flex items-baseline gap-1">
                <span className="text-fg-3">{t("trader.opt.col.pnl")}</span>
                <span className="font-semibold">
                  <Pnl value={pnl} text={moneySigned(pnl)} />
                </span>
              </span>
            )}
          </span>
        )}
        <button onClick={() => void load()} title={t("trader.opt.set.refresh")} aria-label={t("trader.opt.set.refresh")} className="grid size-7 shrink-0 place-items-center rounded-[6px] text-fg-3 hover:bg-surface-3 hover:text-fg">
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
        </button>
      </div>
      <div className="t-scroll min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
        {(items ?? []).map((x) => (
          <Row key={`${x.ticket}-${x.run}-${x.at}`} x={x} locale={locale} />
        ))}
        {items && !items.length && (
          <div className="grid h-full min-h-32 place-items-center p-4 text-center">
            <div className="max-w-[380px]">
              <div className="mx-auto mb-2 grid size-10 place-items-center rounded-full border border-line bg-surface-2 text-fg-3">
                <CalendarCheck2 className="size-4" />
              </div>
              <div className="text-[13px] font-semibold text-fg">{t("trader.opt.set.empty")}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-fg-3">{t("trader.opt.set.emptyHint")}</p>
            </div>
          </div>
        )}
        {!items && !err && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[58px] animate-pulse rounded-[12px] bg-surface-2/70" />)}
        {err && <div className="rounded-[10px] border border-down/30 bg-down-soft px-3 py-2 text-[12px] text-down">{errText(err)}</div>}
      </div>
    </div>
  );
}
