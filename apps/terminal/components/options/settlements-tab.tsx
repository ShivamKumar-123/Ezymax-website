"use client";

// Toolbox › Settlements: how expired option positions settled (the TWAP fixing, the payout credited or debited, and
// the settlement run: run 2+ is a re-fix within the hour after the cut, plan O39).
import * as React from "react";
import { CalendarCheck2, RefreshCw } from "lucide-react";
import { OPTION_SPEC, parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { fmtServer } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { Empty, Pnl } from "@/components/ui/primitives";
import type { EngineErr } from "@/lib/engine/map";
import { optionsApi, isLaunchingSoon } from "@/lib/options/api";
import { errText } from "@/lib/options/errors";
import type { Settlement } from "@/lib/options/types";
import { OptAvatar, OptionsUnavailable, RightTag, SideTag } from "./bits";
import { expiryLabel, px, usdSigned } from "./format";

export function SettlementsTab() {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const login = T.account.login;
  const [items, setItems] = React.useState<Settlement[] | null>(null);
  const [err, setErr] = React.useState<EngineErr | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    const r = await optionsApi.settlements(login);
    setBusy(false);
    if (r.ok) {
      setItems([...(r.data.items ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)));
      setErr(null);
    } else setErr(r.err);
  }, [login]);
  React.useEffect(() => {
    void load();
  }, [load]);

  if (err && isLaunchingSoon(err)) return <OptionsUnavailable kind="soon" compact onRetry={() => void load()} />;
  const total = (items ?? []).reduce((s, x) => s + x.payout, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0">
          <thead>
            <tr>
              <Th className="ps-3">{t("trader.opt.set.settled")}</Th>
              <Th>{t("toolbox.col.ticket")}</Th>
              <Th>{t("trader.opt.col.series")}</Th>
              <Th>{t("trader.opt.col.side")}</Th>
              <Th right>{t("trader.opt.ticket.contracts")}</Th>
              <Th right>{t("trader.opt.set.fixing")}</Th>
              <Th right>{t("trader.opt.set.payout")}</Th>
              <Th>{t("trader.opt.set.run")}</Th>
              <Th className="w-8 pe-2">
                <button onClick={() => void load()} title={t("trader.opt.set.refresh")} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
                  <RefreshCw className={cn("size-3", busy && "animate-spin")} />
                </button>
              </Th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((x) => {
              const s = parseSeriesCode(x.series);
              const digits = s ? (OPTION_SPEC[s.underlying]?.digits ?? 5) : 5;
              return (
                <tr key={`${x.ticket}-${x.run}`} className="hover:bg-surface-2/70">
                  <Td mono className="ps-3 text-fg-2">
                    {fmtServer(x.at, false)}
                  </Td>
                  <Td mono className="text-fg-3">
                    {x.ticket}
                  </Td>
                  <Td>
                    {s ? (
                      <span className="flex items-center gap-1.5">
                        <OptAvatar symbol={s.underlying} size={13} />
                        <span className="font-medium">{s.underlying}</span>
                        <span className="font-mono">{s.strikeLabel}</span>
                        <RightTag right={s.right} />
                        <span className="text-fg-3">{expiryLabel(s.date, locale, false)}</span>
                      </span>
                    ) : (
                      <span className="font-mono">{x.series}</span>
                    )}
                  </Td>
                  <Td>
                    <SideTag side={x.side} />
                  </Td>
                  <Td right mono>
                    {x.contracts}
                  </Td>
                  <Td right mono>
                    {px(x.fixing, digits)}
                  </Td>
                  <Td right className="font-semibold">
                    <Pnl value={x.payout} text={usdSigned(x.payout)} />
                  </Td>
                  <Td>{x.run > 1 ? <span className="rounded-[4px] bg-warn-soft px-1.5 text-[10px] font-semibold text-warn">{t("trader.opt.set.rerun", { n: x.run })}</span> : <span className="text-fg-3">#{x.run}</span>}</Td>
                  <Td />
                </tr>
              );
            })}
            {items && !items.length && (
              <tr>
                <td colSpan={9} className="h-32 border-b border-line/60">
                  <Empty icon={<CalendarCheck2 />} title={t("trader.opt.set.empty")} sub={t("trader.opt.set.emptyHint")} />
                </td>
              </tr>
            )}
            {!items && !err && (
              <tr>
                <td colSpan={9} className="h-12 border-b border-line/60 text-center text-[12px] text-fg-3">
                  {t("trader.opt.set.loading")}
                </td>
              </tr>
            )}
            {err && (
              <tr>
                <td colSpan={9} className="h-12 border-b border-line/60 text-center text-[12px] text-down">
                  {errText(err)}
                </td>
              </tr>
            )}
          </tbody>
          {!!items?.length && (
            <tfoot>
              <tr className="[&>td]:sticky [&>td]:bottom-0 [&>td]:z-[1] [&>td]:border-t [&>td]:border-line [&>td]:bg-panel-2">
                <td colSpan={6} className="h-[28px] ps-3 text-[11.5px] text-fg-3">
                  {t("trader.opt.set.summary", { count: items.length })} · {t("trader.opt.set.twapNote")}
                </td>
                <td className="px-2 text-end text-[12px] font-semibold">
                  <Pnl value={total} text={usdSigned(total)} />
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
