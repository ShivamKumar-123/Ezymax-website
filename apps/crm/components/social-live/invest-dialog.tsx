"use client";

import * as React from "react";
import { CalendarClock, Loader2, Lock, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, KeyValue, Skeleton, Toggle, cn } from "@kalks/ui";
import { Checkbox, RangeSlider, ToggleChip } from "@/components/social/controls";
import { serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, nav4, socialApi, units4, usd, useSocial, type FundDetail, type RequestView } from "./api";
import { InfoBox, MasterIdentity, useNumber } from "./bits";

/** Invest in a PAMM fund: the wallet is debited now, units are issued at the next rollover NAV. */
export function InvestDialog({ fundId, open, onOpenChange, onDone }: { fundId: number | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const q = useSocial<FundDetail>(open && fundId ? `funds/${fundId}` : null);
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
  const err = !f ? undefined : !(amt > 0) ? "Enter an amount" : amt < f.minInvestment ? `Minimum investment is ${usd(f.minInvestment, 0)}` : undefined;
  const frozen = f?.status !== undefined && f.status !== "active";
  const next = f?.nextRolloverAt ? serverTime(f.nextRolloverAt) : "the next rollover";

  const confirm = async () => {
    if (!f || err || !agree) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { amount: amt };
      if (slOn) body.stopLossPct = sl;
      await socialApi<{ request: RequestView }>(`funds/${f.id}/invest`, { body });
      toast.success("Investment queued", { description: `${usd(amt)} debited from your wallet · units are issued at the rollover on ${next} (server time)` });
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("Couldn't queue the investment", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={600}
      title={f ? <>Invest in {f.name}</> : "Invest"}
      description="Your wallet is debited now; units are issued at the next rollover NAV."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="ember" onClick={confirm} disabled={!f || !!err || !agree || busy || frozen}>
            {busy && <Loader2 className="animate-spin" />} Queue investment
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
            <MasterIdentity nickname={f.master.nickname} size={38} sub={`NAV ${nav4(f.nav)} · ${PERIOD_LABEL[f.period].toLowerCase()} rollover`} />
            <span className="text-[12px] text-fg-3">Min {usd(f.minInvestment, 0)}</span>
          </div>
          {frozen && (
            <InfoBox tone="warn" icon={<Snowflake />}>
              This fund is {f.status} and isn&apos;t accepting new investments.
            </InfoBox>
          )}
          <Field label="Amount" error={amount.raw ? err : undefined} hint="USD from your wallet">
            <Input type="number" inputMode="decimal" min={f.minInvestment} value={amount.raw} onChange={(e) => amount.setRaw(e.target.value)} leading="$" trailing="USD" inputClassName="k-num text-[16px] font-medium" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[f.minInvestment, 500, 1000, 2500, 5000]
              .filter((v, i, arr) => v >= f.minInvestment && v > 0 && arr.indexOf(v) === i)
              .map((v) => (
                <ToggleChip key={v} on={amt === v} onClick={() => amount.set(v)}>
                  {usd(v, 0)}
                </ToggleChip>
              ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="k-row px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Units (estimate)</div>
              <div className="k-num mt-1 text-[18px] font-semibold">{f.nav > 0 ? units4(amt / f.nav) : "—"}</div>
              <div className="text-[11.5px] text-fg-3">at today&apos;s NAV {nav4(f.nav)}</div>
            </div>
            <div className="k-row px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Executes at</div>
              <div className="mt-1 flex items-center gap-1.5 text-[14px] font-medium">
                <CalendarClock className="size-4 text-ember" /> {next}
              </div>
              <div className="text-[11.5px] text-fg-3">{PERIOD_LABEL[f.period]} rollover · server time</div>
            </div>
          </div>

          <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">Investor stop-loss</div>
                <div className="text-[12px] text-fg-3">Redeems you at once if your value falls this far below what you put in</div>
              </div>
              <Toggle checked={slOn} onChange={setSlOn} label="Investor stop-loss" />
            </div>
            <div className={cn("mt-4", !slOn && "pointer-events-none opacity-40")}>
              <div className="mb-1 flex justify-between text-[12.5px]">
                <span className="text-fg-3">Trigger</span>
                <span className="k-num font-medium text-down">
                  -{sl}%{amt > 0 ? ` · at ${usd(amt * (1 - sl / 100), 0)}` : ""}
                </span>
              </div>
              <RangeSlider value={sl} onChange={setSl} min={5} max={90} tone="down" ticks={[5, 10, 20, 50, 90]} format={(v) => `${v}%`} label="Stop-loss" />
            </div>
          </div>

          <KeyValue
            rows={[
              ["Performance fee", `${f.perfFeePct}% above your high-water mark`],
              [
                "Lock-in",
                f.lockInDays ? (
                  <span key="l" className="inline-flex items-center gap-1.5">
                    <Lock className="size-3.5 text-warn" /> {f.lockInDays} days from your first investment
                  </span>
                ) : (
                  "None"
                ),
              ],
              ["Fund drawdown freeze", `Trading stops at -${f.maxDdPct}% from peak NAV`],
            ]}
          />
          <InfoBox>
            The amount is debited from your wallet now and the request stays pending until the rollover on {next}. Units are issued at the NAV calculated then, so the final count may differ from this estimate. You can cancel while it is pending and the amount goes back to your wallet.
          </InfoBox>
          <Checkbox checked={agree} onChange={setAgree}>
            I understand PAMM investments can lose value and past returns don&apos;t guarantee future results.
          </Checkbox>
        </div>
      )}
    </Dialog>
  );
}
