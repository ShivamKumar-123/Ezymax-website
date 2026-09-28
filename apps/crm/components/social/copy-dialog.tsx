"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Coins, Info, Layers, Percent, ShieldCheck, Wallet, X as XIcon, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, KeyValue, Money, Stepper, SymbolAvatar, cn, formatMoney } from "@kalks/ui";
import { WALLET } from "@kalks/mock";
import { SIZING_MODES, SOCIAL_POLICY, type Master, type SizingMode } from "@kalks/mock/social";
import { Checkbox, RadioCard, RangeSlider, ToggleChip } from "./controls";
import { MasterIdentity, RiskBadge } from "./master-bits";

const STEPS = ["Sizing", "Amount", "Risk controls", "Review"];
const MODE_ICON: Record<SizingMode, React.ReactNode> = {
  proportional: <Scale />,
  "fixed-lot": <Layers />,
  multiplier: <Percent />,
  "fixed-allocation": <Coins />,
};
const EXTRA_SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY", "NAS100", "US30", "BTCUSD", "ETHUSD", "USOIL"];

export function masterEquityUsd(m: Master) {
  return Math.round((m.aum * m.ownCapitalPct) / 100 / 10) * 10 || 50000;
}

function newCopyLogin(m: Master) {
  let h = 0;
  for (const ch of m.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${SOCIAL_POLICY.copyAccountPrefix}${String(204000 + (h % 90000)).padStart(6, "0")}`;
}

export function CopyDialog({ master: m, open, onOpenChange }: { master: Master | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = React.useState(0);
  const [mode, setMode] = React.useState<SizingMode>("proportional");
  const [fixedLot, setFixedLot] = React.useState(0.1);
  const [mult, setMult] = React.useState(0.5);
  const [perTrade, setPerTrade] = React.useState(50);
  const [amount, setAmount] = React.useState(1000);
  const [stopPct, setStopPct] = React.useState(25);
  const [maxLot, setMaxLot] = React.useState(1);
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [agree, setAgree] = React.useState(false);
  const wallet = WALLET.assets[0]!.balance;

  React.useEffect(() => {
    if (open && m) {
      setStep(0);
      setAgree(false);
      setExcluded([]);
      setAmount(Math.max(m.minInvestment, 1000));
    }
  }, [open, m]);

  if (!m) return null;

  const mEq = masterEquityUsd(m);
  const exSym = m.instruments[0]!.label;
  const exLot = 5;
  const exampleLot = (() => {
    const raw =
      mode === "proportional" ? exLot * (amount / mEq) : mode === "fixed-lot" ? fixedLot : mode === "multiplier" ? exLot * mult : perTrade / (exSym === "XAUUSD" ? 150 : 120);
    return Math.min(maxLot, Math.max(0.01, Math.floor(raw * 100) / 100));
  })();
  const symbols = Array.from(new Set([...m.instruments.map((i) => i.label), ...EXTRA_SYMBOLS])).slice(0, 12);
  const login = newCopyLogin(m);
  const amountErr = amount < m.minInvestment ? `Minimum allocation is ${formatMoney(m.minInvestment)}` : amount > wallet ? "Exceeds wallet balance" : undefined;

  const next = () => {
    if (step === 1 && amountErr) return toast.error(amountErr);
    if (step < 3) setStep(step + 1);
    else {
      if (!agree) return toast.error("Please accept the copy terms to continue");
      toast.success(`Now copying ${m.person.name}`, { description: `Copy account #${login} created · ${formatMoney(amount)} allocated from wallet` });
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={680}
      title={<>Start copying · {m.strategy}</>}
      description="Every copy subscription runs in its own dedicated copy account."
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}>
            {step === 0 ? "Cancel" : (
              <>
                <ArrowLeft /> Back
              </>
            )}
          </Button>
          <Button variant="ember" size="md" onClick={next} disabled={step === 3 && !agree}>
            {step === 3 ? "Confirm & start copying" : (
              <>
                Continue <ArrowRight />
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3">
        <MasterIdentity m={m} size={38} sub={`Perf. fee ${m.perfFee}% · HWM · min ${formatMoney(m.minInvestment, "USD", 0)}`} />
        <RiskBadge risk={m.risk} showLabel />
      </div>
      <Stepper steps={STEPS} current={step} className="mb-6" />

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
          {step === 0 && (
            <div className="space-y-4">
              <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SIZING_MODES.map((s) => (
                  <RadioCard key={s.key} selected={mode === s.key} onSelect={() => setMode(s.key)} title={s.title} text={s.text} icon={MODE_ICON[s.key]} />
                ))}
              </div>
              {mode !== "proportional" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {mode === "fixed-lot" && (
                    <Field label="Lot size per trade">
                      <Input type="number" step={0.01} min={0.01} value={fixedLot} onChange={(e) => setFixedLot(Math.max(0.01, +e.target.value))} trailing="lots" />
                    </Field>
                  )}
                  {mode === "multiplier" && (
                    <Field label="Multiplier" hint={`${mult.toFixed(2)}×`}>
                      <div className="pt-2">
                        <RangeSlider value={mult} onChange={setMult} min={0.1} max={3} step={0.1} ticks={[0.1, 0.5, 1, 2, 3]} format={(v) => `${v}×`} label="Multiplier" />
                      </div>
                    </Field>
                  )}
                  {mode === "fixed-allocation" && (
                    <Field label="Risk per master trade">
                      <Input type="number" min={5} value={perTrade} onChange={(e) => setPerTrade(Math.max(5, +e.target.value))} leading="$" trailing="USD" />
                    </Field>
                  )}
                </div>
              )}
              <ExampleBox>
                Master (equity {formatMoney(mEq, "USD", 0)}) opens <b className="text-fg">{exLot.toFixed(2)} lots {exSym}</b> → your copy account opens{" "}
                <b className="k-num text-ember">{exampleLot.toFixed(2)} lots</b>
                {mode === "proportional" && <> (ratio {formatMoney(amount, "USD", 0)} / {formatMoney(mEq, "USD", 0)})</>}
                {mode === "multiplier" && <> ({exLot} × {mult.toFixed(1)})</>}
                {mode === "fixed-allocation" && <> (≈{formatMoney(perTrade, "USD", 0)} risk at the master&apos;s stop)</>}
                {exampleLot === maxLot && <> · capped by your max lot</>}.
              </ExampleBox>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-[16px] border border-line bg-surface-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full border border-line bg-surface-3 text-fg-2">
                    <Wallet className="size-4" />
                  </span>
                  <div>
                    <div className="text-[12px] text-fg-3">Wallet balance · USDT TRC20</div>
                    <Money value={wallet} className="text-[16px] font-medium" countUp={false} />
                  </div>
                </div>
                <span className="text-[12px] text-fg-3">Min {formatMoney(m.minInvestment, "USD", 0)}</span>
              </div>
              <Field label="Amount to allocate" error={amountErr}>
                <Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} leading="$" trailing="USD" inputClassName="k-num text-[16px] font-medium" />
              </Field>
              <RangeSlider value={Math.min(amount, wallet)} onChange={setAmount} min={0} max={Math.floor(wallet)} step={50} label="Amount" />
              <div className="flex flex-wrap gap-2">
                {[0.1, 0.25, 0.5, 1].map((f) => (
                  <ToggleChip key={f} on={Math.round(wallet * f) === amount} onClick={() => setAmount(Math.floor(wallet * f))}>
                    {f === 1 ? "Max" : `${f * 100}%`}
                  </ToggleChip>
                ))}
              </div>
              <ExampleBox>
                Funds move from your wallet into the new copy account <span className="font-mono text-fg">#{login}</span>. You can add or withdraw funds later; withdrawing stops copying once positions are closed.
              </ExampleBox>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-fg-2">Equity stop</span>
                  <span className="k-num font-medium text-down">
                    -{stopPct}% · stop at {formatMoney(amount * (1 - stopPct / 100), "USD", 0)}
                  </span>
                </div>
                <RangeSlider value={stopPct} onChange={setStopPct} min={5} max={60} step={1} tone="down" ticks={[5, 15, 25, 40, 60]} format={(v) => `${v}%`} label="Equity stop" />
                <p className="mt-2 text-[12px] text-fg-3">If equity falls this far from your allocation, all copied positions close and copying stops.</p>
              </div>
              <Field label="Max lot per copied trade" hint="Caps any single position">
                <Input type="number" step={0.01} min={0.01} value={maxLot} onChange={(e) => setMaxLot(Math.max(0.01, +e.target.value))} trailing="lots" />
              </Field>
              <div>
                <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
                  Exclude symbols
                  <span className="font-normal text-fg-3">{excluded.length ? `${excluded.length} excluded` : "Copy everything"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {symbols.map((s) => {
                    const on = excluded.includes(s);
                    return (
                      <ToggleChip key={s} tone="down" on={on} onClick={() => setExcluded((x) => (on ? x.filter((y) => y !== s) : [...x, s]))}>
                        <SymbolAvatar symbol={s} size={16} />
                        {s}
                        {on && <XIcon className="size-3" />}
                      </ToggleChip>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="k-hot-card relative overflow-hidden rounded-[16px] px-5 py-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-5 text-ember" />
                  <div className="text-[14px]">
                    A dedicated copy account <span className="font-mono font-semibold text-fg">#{login}</span> will be created on Kalks-Live01.
                  </div>
                </div>
              </div>
              <KeyValue
                rows={[
                  ["Master", `${m.person.name} · ${m.strategy}`],
                  ["Sizing", `${SIZING_MODES.find((s) => s.key === mode)!.title}${mode === "fixed-lot" ? ` · ${fixedLot.toFixed(2)} lot` : mode === "multiplier" ? ` · ${mult.toFixed(1)}×` : mode === "fixed-allocation" ? ` · ${formatMoney(perTrade, "USD", 0)}/trade` : ""}`],
                  ["Allocation", formatMoney(amount)],
                  ["Equity stop", `-${stopPct}% (${formatMoney(amount * (1 - stopPct / 100))})`],
                  ["Max lot", `${maxLot.toFixed(2)} lots`],
                  ["Excluded symbols", excluded.length ? excluded.join(", ") : "None"],
                  ["Performance fee", `${m.perfFee}% above high-water mark`],
                ]}
              />
              <div className="flex items-start gap-2 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg-3">
                <Info className="mt-0.5 size-4 shrink-0" />
                Everything is mirrored: opens, partial closes, SL/TP changes and pending orders. Copied trades can&apos;t be closed one by one — pause or stop copying instead. Fees accrue as pending and are released after admin approval.
              </div>
              <Checkbox checked={agree} onChange={setAgree}>
                I understand copy trading carries risk and accept the copy-trading terms and the master&apos;s fee terms.
              </Checkbox>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Dialog>
  );
}

function ExampleBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[14px] border border-gold/25 bg-gold-soft px-4 py-3 text-[12.5px] leading-relaxed text-fg-2")}>
      <Info className="mt-0.5 size-4 shrink-0 text-gold" />
      <div>{children}</div>
    </div>
  );
}
