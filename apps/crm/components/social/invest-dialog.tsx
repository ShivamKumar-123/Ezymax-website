"use client";

import * as React from "react";
import { CalendarClock, Info, Lock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, KeyValue, Money, Toggle, cn, formatMoney } from "@kalks/ui";
import { WALLET } from "@kalks/mock";
import { masterById, type PammFund } from "@kalks/mock/social";
import { Checkbox, RangeSlider, ToggleChip } from "./controls";
import { MasterIdentity, RiskBadge } from "./master-bits";

export function InvestDialog({ fund, open, onOpenChange }: { fund: PammFund | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [amount, setAmount] = React.useState(1000);
  const [slOn, setSlOn] = React.useState(true);
  const [sl, setSl] = React.useState(20);
  const [agree, setAgree] = React.useState(false);
  const wallet = WALLET.assets[0]!.balance;

  React.useEffect(() => {
    if (open && fund) {
      setAmount(Math.max(fund.minInvestment, 1000));
      setAgree(false);
    }
  }, [open, fund]);

  if (!fund) return null;
  const m = masterById(fund.masterId)!;
  // Indicative NAV at next rollover (current NAV; final NAV is fixed at rollover)
  const units = amount / fund.navPerUnit;
  const err = amount < fund.minInvestment ? `Minimum investment is ${formatMoney(fund.minInvestment, "USD", 0)}` : amount > wallet ? "Exceeds wallet balance" : undefined;

  const confirm = () => {
    if (err) return toast.error(err);
    if (!agree) return toast.error("Please accept the fund terms");
    toast.success(`Request queued until rollover (${fund.nextRolloverLabel})`, {
      description: `${formatMoney(amount)} → ${fund.name} · ≈${units.toFixed(4)} units`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={600}
      title={<>Invest in {fund.name}</>}
      description="Requests are queued and executed at the next rollover NAV."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="ember" onClick={confirm} disabled={!agree}>
            Queue investment
          </Button>
        </>
      }
    >
      <div className="mb-5 flex items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3">
        <MasterIdentity m={m} size={38} sub={`NAV/unit ${fund.navPerUnit.toFixed(4)} · ${fund.rollover} rollover`} />
        <RiskBadge risk={fund.risk} showLabel />
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="flex items-center gap-2 text-fg-3">
            <Wallet className="size-3.5" /> Wallet
          </span>
          <Money value={wallet} countUp={false} className="font-medium" />
        </div>
        <Field label="Amount" error={err} hint={`Min ${formatMoney(fund.minInvestment, "USD", 0)}`}>
          <Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} leading="$" trailing="USD" inputClassName="k-num text-[16px] font-medium" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[500, 1000, 2500, 5000].filter((v) => v >= fund.minInvestment).map((v) => (
            <ToggleChip key={v} on={amount === v} onClick={() => setAmount(v)}>
              {formatMoney(v, "USD", 0)}
            </ToggleChip>
          ))}
          <ToggleChip on={amount === Math.floor(wallet)} onClick={() => setAmount(Math.floor(wallet))}>
            Max
          </ToggleChip>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Units (preview)</div>
            <div className="k-num mt-1 text-[18px] font-semibold">{units.toFixed(4)}</div>
            <div className="text-[11.5px] text-fg-3">at NAV {fund.navPerUnit.toFixed(4)}</div>
          </div>
          <div className="k-row px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Executes at</div>
            <div className="mt-1 flex items-center gap-1.5 text-[14px] font-medium">
              <CalendarClock className="size-4 text-ember" /> {fund.nextRolloverLabel}
            </div>
            <div className="text-[11.5px] text-fg-3 capitalize">{fund.rollover} rollover</div>
          </div>
        </div>

        <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-medium">Investor stop-loss</div>
              <div className="text-[12px] text-fg-3">Auto-redeem at the next rollover if your investment drops this far</div>
            </div>
            <Toggle checked={slOn} onChange={setSlOn} label="Investor stop-loss" />
          </div>
          <div className={cn("mt-4 transition-opacity", !slOn && "pointer-events-none opacity-40")}>
            <div className="mb-1 flex justify-between text-[12.5px]">
              <span className="text-fg-3">Trigger</span>
              <span className="k-num font-medium text-down">
                -{sl}% · {formatMoney(amount * (1 - sl / 100), "USD", 0)}
              </span>
            </div>
            <RangeSlider value={sl} onChange={setSl} min={5} max={50} tone="down" ticks={[5, 10, 20, 30, 50]} format={(v) => `${v}%`} label="Stop-loss" />
          </div>
        </div>

        <KeyValue
          rows={[
            ["Performance fee", `${fund.perfFee}% above high-water mark`],
            ["Management fee", fund.mgmtFee ? `${fund.mgmtFee}%` : "None"],
            [
              "Lock-in",
              fund.lockInDays ? (
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5 text-warn" /> {fund.lockInDays} days
                </span>
              ) : (
                "None"
              ),
            ],
            ["Fund drawdown freeze", `Trading frozen at -${fund.ddFreeze}%`],
          ]}
        />
        <div className="flex items-start gap-2 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg-3">
          <Info className="mt-0.5 size-4 shrink-0" />
          The amount is reserved from your wallet now. Units are issued at the NAV calculated at rollover, so the final unit count may differ slightly from this preview.
        </div>
        <Checkbox checked={agree} onChange={setAgree}>
          I have read the fund&apos;s offer terms and understand PAMM investments can lose value.
        </Checkbox>
      </div>
    </Dialog>
  );
}
