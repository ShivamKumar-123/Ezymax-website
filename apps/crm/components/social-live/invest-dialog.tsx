"use client";

import * as React from "react";
import { CalendarClock, Loader2, Lock, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, KeyValue, Skeleton, Toggle, cn } from "@/components/kit";
import { useT } from "@kalks/i18n/react";
import { Checkbox, RangeSlider, ToggleChip } from "@/components/social/controls";
import { serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, nav4, socialApi, units4, usd, useSocial, type FundDetail, type RequestView } from "./api";
import { InfoBox, MasterIdentity, useNumber } from "./bits";
import { fmt as fmtUsdt, usdtAvailable, useWallet, type Overview } from "@/components/wallet-live/api";

/** Invest in a PAMM fund: the wallet is debited now, units are issued at the next rollover NAV. */
export function InvestDialog({ fundId, open, onOpenChange, onDone }: { fundId: number | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const t = useT();
  const q = useSocial<FundDetail>(open && fundId ? `funds/${fundId}` : null);
  // the investment is debited from the USDT wallet: show the balance and stop an amount above it
  const wallet = useWallet<Overview>(open ? "overview" : null);
  const available = wallet.data ? Number(usdtAvailable(wallet.data).available) : null;
  const amount = useNumber(null);
  const [slOn, setSlOn] = React.useState(false);
  const [sl, setSl] = React.useState(20);
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const f = q.data?.fund;

  React.useEffect(() => {
    if (open) {
      setAgree(false);
      setSlOn(false);
      setSl(20);
    }
  }, [open, fundId]);
  React.useEffect(() => {
    if (open && f) amount.set(Math.max(f.minInvestment, 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, f?.id]);

  const amt = amount.value ?? 0;
  const err = !f
    ? undefined
    : !(amt > 0)
      ? t("social.follow.err.enterAmount")
      : amt < f.minInvestment
        ? t("social.invest.err.min", { amount: usd(f.minInvestment, 0) })
        : available !== null && amt > available
          ? t("social.follow.err.overBalance", { balance: fmtUsdt(available) })
          : undefined;
  const frozen = f?.status !== undefined && f.status !== "active";
  const next = f?.nextRolloverAt ? serverTime(f.nextRolloverAt) : t("social.invest.theNextRollover");

  const confirm = async () => {
    if (!f || err || !agree) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { amount: amt };
      if (slOn) body.stopLossPct = sl;
      await socialApi<{ request: RequestView }>(`funds/${f.id}/invest`, { body });
      toast.success(t("social.invest.toast.queued"), { description: t("social.invest.toast.queuedDesc", { amount: usd(amt), next }) });
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(t("social.invest.toast.failed"), { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={600}
      title={f ? t("social.invest.title", { name: f.name }) : t("social.invest")}
      description={t("social.invest.description")}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="ember" onClick={confirm} disabled={!f || !!err || !agree || busy || frozen}>
            {busy && <Loader2 className="animate-spin" />} {t("social.invest.queue")}
          </Button>
        </>
      }
    >
      {!f ? (
        q.error ? (
          <InfoBox tone="down">{q.error.message}</InfoBox>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-[16px]" />
            <Skeleton className="h-11 w-full rounded-[14px]" />
            <Skeleton className="h-24 w-full rounded-[16px]" />
          </div>
        )
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3">
            <MasterIdentity nickname={f.master.nickname} size={38} sub={t("social.invest.navSub", { nav: nav4(f.nav), period: PERIOD_LABEL[f.period].toLowerCase() })} />
            <span className="text-[12px] text-fg-3">{t("social.minAmount", { amount: usd(f.minInvestment, 0) })}</span>
          </div>
          {frozen && (
            <InfoBox tone="warn" icon={<Snowflake />}>
              {t("social.invest.frozen", { status: t.dyn(`social.fundStatus.${f.status}`, f.status).toLowerCase() })}
            </InfoBox>
          )}
          <Field label={t("common.amount")} error={amount.raw ? err : undefined} hint={available !== null ? `${t("social.invest.usdFromWallet")} · ${t("social.follow.walletAvailable", { balance: fmtUsdt(available) })}` : t("social.invest.usdFromWallet")}>
            <Input type="number" inputMode="decimal" min={f.minInvestment} value={amount.raw} onChange={(e) => amount.setRaw(e.target.value)} leading="$" trailing="USD" inputClassName="k-num text-[16px] font-medium" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[f.minInvestment, 500, 1000, 2500, 5000]
              .filter((v, i, arr) => v >= f.minInvestment && v > 0 && arr.indexOf(v) === i && (available === null || v <= available))
              .map((v) => (
                <ToggleChip key={v} on={amt === v} onClick={() => amount.set(v)}>
                  {usd(v, 0)}
                </ToggleChip>
              ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="k-row px-4 py-3">
              <div className="text-[12px] text-fg-3">{t("social.invest.unitsEstimate")}</div>
              <div className="k-num mt-1 text-[18px] font-semibold">{f.nav > 0 ? units4(amt / f.nav) : "—"}</div>
              <div className="text-[11.5px] text-fg-3">{t("social.invest.atNav", { nav: nav4(f.nav) })}</div>
            </div>
            <div className="k-row px-4 py-3">
              <div className="text-[12px] text-fg-3">{t("social.invest.executesAt")}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[14px] font-medium">
                <CalendarClock className="size-4 text-ember" /> {next}
              </div>
              <div className="text-[11.5px] text-fg-3">{t("social.invest.rolloverServerTime", { period: PERIOD_LABEL[f.period] })}</div>
            </div>
          </div>

          <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">{t("social.invest.sl")}</div>
                <div className="text-[12px] text-fg-3">{t("social.invest.slHint")}</div>
              </div>
              <Toggle checked={slOn} onChange={setSlOn} label={t("social.invest.sl")} />
            </div>
            <div className={cn("mt-4", !slOn && "pointer-events-none opacity-40")}>
              <div className="mb-1 flex justify-between text-[12.5px]">
                <span className="text-fg-3">{t("social.follow.trigger")}</span>
                <span className="k-num font-medium text-down">
                  -{sl}%{amt > 0 ? ` · ${t("social.invest.atValue", { amount: usd(amt * (1 - sl / 100), 0) })}` : ""}
                </span>
              </div>
              <RangeSlider value={sl} onChange={setSl} min={5} max={90} tone="down" ticks={[5, 10, 20, 50, 90]} format={(v) => `${v}%`} label={t("social.invest.stopLoss")} />
            </div>
          </div>

          <KeyValue
            rows={[
              [t("social.performanceFee"), t("social.invest.feeAboveHwm", { fee: f.perfFeePct })],
              [
                t("social.lockIn"),
                f.lockInDays ? (
                  <span key="l" className="inline-flex items-center gap-1.5">
                    <Lock className="size-3.5 text-warn" /> {t("social.invest.lockDays", { count: f.lockInDays })}
                  </span>
                ) : (
                  t("common.none")
                ),
              ],
              [t("social.invest.ddFreeze"), t("social.invest.ddFreezeValue", { dd: f.maxDdPct })],
            ]}
          />
          <InfoBox>
            {t("social.invest.note", { next })}
          </InfoBox>
          <Checkbox checked={agree} onChange={setAgree}>
            {t("social.invest.agree")}
          </Checkbox>
        </div>
      )}
    </Dialog>
  );
}
