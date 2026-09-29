"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Coins, Layers, Loader2, Percent, Scale, Search, ShieldCheck, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, KeyValue, Stepper, SymbolAvatar, Toggle, cn } from "@kalks/ui";
import { Checkbox, RadioCard, RangeSlider, ToggleChip } from "@/components/social/controls";
import { TradeButton } from "@/components/trading/ui";
import { ApiError, PERIOD_LABEL, SIZING_LABEL, sizingText, socialApi, usd, useSocial, type FollowResult, type MasterView, type SizingMode } from "./api";
import { InfoBox, MasterIdentity, RiskBadge, useNumber } from "./bits";

const STEPS = ["Sizing", "Risk limits", "Amount", "Review"];

const MODES: { key: SizingMode; text: string; icon: React.ReactNode }[] = [
  { key: "equity", icon: <Scale />, text: "Trades scale with your copy account's equity against the master's equity." },
  { key: "fixed_lot", icon: <Layers />, text: "Every copied open uses the same lot size, whatever the master trades." },
  { key: "multiplier", icon: <Percent />, text: "The master's lot size times your multiplier, for example 0.5× or 2×." },
  { key: "allocation", icon: <Coins />, text: "Sized as if you had a fixed USD amount against the master's equity." },
];

/** Follower lot for a 1.00-lot master trade (rounded down to 0.01, capped by max lot). */
function exampleLot(mode: SizingMode, value: number, allocation: number, masterEquity: number, maxLot: number | null) {
  const me = masterEquity > 0 ? masterEquity : 0;
  let v = mode === "equity" ? (me ? allocation / me : 0) : mode === "allocation" ? (me ? value / me : 0) : mode === "multiplier" ? value : value;
  v = Math.floor(v * 100 + 1e-9) / 100;
  if (maxLot && v > maxLot) v = maxLot;
  return v;
}

export function FollowDialog({ master: m, open, onOpenChange, suggested = [], onDone }: { master: MasterView | null; open: boolean; onOpenChange: (o: boolean) => void; suggested?: string[]; onDone?: () => void }) {
  const [step, setStep] = React.useState(0);
  const [mode, setMode] = React.useState<SizingMode>("equity");
  const value = useNumber(1);
  const allocation = useNumber(null);
  const maxLot = useNumber(null);
  const equityStop = useNumber(null);
  const [ddOn, setDdOn] = React.useState(true);
  const [dd, setDd] = React.useState(30);
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [q, setQ] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<FollowResult | null>(null);
  const symbolsQ = useSocial<{ symbols: { symbol: string; assetClass: string | null }[] }>(open ? "symbols" : null);

  React.useEffect(() => {
    if (open && m) {
      setStep(0);
      setMode("equity");
      value.set(1);
      allocation.set(Math.max(m.minAllocation, 100));
      maxLot.set(null);
      equityStop.set(null);
      setDdOn(true);
      setDd(30);
      setExcluded([]);
      setQ("");
      setAgree(false);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, m?.id]);

  if (!m) return null;

  const alloc = allocation.value ?? 0;
  const val = mode === "equity" ? 1 : value.value ?? 0;
  const masterEq = m.stats.equity;
  const lot = exampleLot(mode, val, alloc, masterEq, maxLot.value);

  const sizingErr = mode === "equity" ? undefined : !(val > 0) ? "Enter a value above zero" : mode === "fixed_lot" && val < 0.01 ? "Minimum 0.01 lot" : undefined;
  const allocErr = !(alloc > 0) ? "Enter an amount" : alloc < m.minAllocation ? `Minimum allocation is ${usd(m.minAllocation, 0)}` : undefined;
  const maxLotErr = maxLot.raw && !(maxLot.value! >= 0.01) ? "Minimum 0.01 lot" : undefined;
  const stopErr = equityStop.raw && !(equityStop.value! >= 0) ? "Enter an amount" : equityStop.value !== null && alloc > 0 && equityStop.value >= alloc ? "Must be below your allocation" : undefined;

  const all = symbolsQ.data?.symbols.map((s) => s.symbol) ?? [];
  const ordered = Array.from(new Set([...suggested, ...all]));
  const shown = (q ? ordered.filter((s) => s.toLowerCase().includes(q.toLowerCase())) : ordered).slice(0, 24);

  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { masterId: m.id, sizing: { mode, value: val }, allocation: alloc, excludedSymbols: excluded };
      if (maxLot.value !== null) body.maxLot = maxLot.value;
      if (equityStop.value !== null) body.equityStop = equityStop.value;
      if (ddOn) body.maxDdPct = dd;
      const r = await socialApi<FollowResult>("subscriptions", { body });
      setResult(r);
      if (r.funding?.status === "done") toast.success(`Now copying ${m.nickname}`, { description: `Copy account #${r.account?.login ?? r.subscription.login} · ${usd(alloc)} from your wallet` });
      else toast.warning(`Copy account #${r.account?.login ?? r.subscription.login} created`, { description: "Funding from the wallet didn't go through. You can fund it from the wallet." });
      onDone?.();
    } catch (e) {
      toast.error("Couldn't start copying", { description: e instanceof ApiError || e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 0 && sizingErr) return toast.error(sizingErr);
    if (step === 1 && (maxLotErr || stopErr)) return toast.error(maxLotErr ?? stopErr!);
    if (step === 2 && allocErr) return toast.error(allocErr);
    if (step < 3) setStep(step + 1);
    else if (agree) void submit();
  };

  if (result) {
    const login = result.account?.login ?? result.subscription.login;
    const ok = result.funding?.status === "done";
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        width={560}
        title={ok ? `Now copying ${m.nickname}` : "Copy account created"}
        description={`Copy account #${login} · Kalks-Live`}
        footer={
          <>
            <Link href="/social/copy">
              <Button variant="surface" onClick={() => onOpenChange(false)}>
                My subscriptions
              </Button>
            </Link>
            <TradeButton a={{ login, status: "active" }} size="md" label="Open in Kalks Trader" />
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-full border", ok ? "border-up/30 bg-up-soft text-up" : "border-warn/30 bg-warn-soft text-warn")}>
              {ok ? <Check className="size-6" /> : <AlertTriangle className="size-6" />}
            </span>
            <div className="text-[14px] text-fg-2">
              {ok ? (
                <>
                  {usd(alloc)} moved from your wallet to copy account <span className="font-mono text-fg">#{login}</span>. New trades from {m.nickname} are copied from now on.
                </>
              ) : (
                <>
                  The copy account <span className="font-mono text-fg">#{login}</span> was created, but the wallet transfer didn&apos;t go through
                  {result.funding?.message ? <>: {result.funding.message}</> : "."} You can fund it from the wallet; copying starts once it has a balance.
                </>
              )}
            </div>
          </div>
          <InfoBox>Copied trades can&apos;t be closed one by one in Kalks Trader. To exit, stop copying under Copy trading → My subscriptions: every copied position closes and the balance can go back to your wallet.</InfoBox>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={680}
      title={<>Copy {m.nickname}</>}
      description="Every subscription runs in its own dedicated copy account, funded from your wallet."
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))} disabled={busy}>
            {step === 0 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft /> Back
              </>
            )}
          </Button>
          <Button variant="ember" size="md" onClick={next} disabled={busy || (step === 3 && !agree)}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {step === 3 ? (
              "Confirm & start copying"
            ) : (
              <>
                Continue <ArrowRight />
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3">
        <MasterIdentity nickname={m.nickname} size={38} sub={`${m.strategy} · fee ${m.perfFeePct}% above HWM · min ${usd(m.minAllocation, 0)}`} />
        <RiskBadge risk={m.stats.riskScore} showLabel />
      </div>
      <Stepper steps={STEPS} current={step} className="mb-6" />

      {step === 0 && (
        <div className="space-y-4">
          <div role="radiogroup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MODES.map((s) => (
              <RadioCard
                key={s.key}
                selected={mode === s.key}
                onSelect={() => {
                  setMode(s.key);
                  value.set(s.key === "fixed_lot" ? 0.1 : s.key === "multiplier" ? 1 : s.key === "allocation" ? Math.max(m.minAllocation, alloc || 1000) : 1);
                }}
                title={SIZING_LABEL[s.key]}
                text={s.text}
                icon={s.icon}
              />
            ))}
          </div>
          {mode !== "equity" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={mode === "fixed_lot" ? "Lot size per trade" : mode === "multiplier" ? "Multiplier" : "Allocation used for sizing"} error={sizingErr}>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={mode === "fixed_lot" ? 0.01 : mode === "multiplier" ? 0.1 : 50}
                  min={0}
                  value={value.raw}
                  onChange={(e) => value.setRaw(e.target.value)}
                  leading={mode === "allocation" ? "$" : undefined}
                  trailing={mode === "fixed_lot" ? "lots" : mode === "multiplier" ? "×" : "USD"}
                  inputClassName="k-num"
                />
              </Field>
            </div>
          )}
          <InfoBox tone="gold">
            {masterEq > 0 ? (
              <>
                If {m.nickname} (equity {usd(masterEq, 0)}) opens <b className="text-fg">1.00 lot</b>, your copy account opens{" "}
                <b className="k-num text-ember">{lot.toFixed(2)} lot</b>
                {mode === "equity" && <> (your {usd(alloc, 0)} ÷ {usd(masterEq, 0)}, recalculated at every trade)</>}
                {mode === "allocation" && <> ({usd(val, 0)} ÷ {usd(masterEq, 0)})</>}
                {mode === "multiplier" && <> (1.00 × {val})</>}
                {maxLot.value !== null && lot === maxLot.value && <>, capped by your max lot</>}. Sizes are rounded down to the symbol&apos;s lot step; a result below the minimum lot is skipped.
              </>
            ) : (
              <>Sizes are rounded down to the symbol&apos;s lot step; a result below the minimum lot is skipped and logged.</>
            )}
          </InfoBox>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">Max drawdown stop</div>
                <div className="text-[12px] text-fg-3">Stops copying and closes everything if equity falls this far from its peak</div>
              </div>
              <Toggle checked={ddOn} onChange={setDdOn} label="Max drawdown stop" />
            </div>
            <div className={cn("mt-4", !ddOn && "pointer-events-none opacity-40")}>
              <div className="mb-1 flex justify-between text-[12.5px]">
                <span className="text-fg-3">Trigger</span>
                <span className="k-num font-medium text-down">-{dd}% from peak</span>
              </div>
              <RangeSlider value={dd} onChange={setDd} min={5} max={90} step={1} tone="down" ticks={[5, 20, 30, 50, 90]} format={(v) => `${v}%`} label="Max drawdown" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Equity stop" hint="Optional · USD" error={stopErr}>
              <Input type="number" inputMode="decimal" min={0} placeholder="No equity stop" value={equityStop.raw} onChange={(e) => equityStop.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
            </Field>
            <Field label="Max lot per copied trade" hint="Optional" error={maxLotErr}>
              <Input type="number" inputMode="decimal" step={0.01} min={0.01} placeholder="No cap" value={maxLot.raw} onChange={(e) => maxLot.setRaw(e.target.value)} trailing="lots" inputClassName="k-num" />
            </Field>
          </div>
          <p className="-mt-3 text-[12px] text-fg-3">Limits are checked every few seconds. A breach stops the subscription and closes every copied position and order.</p>
          <div>
            <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
              Exclude symbols
              <span className="font-normal text-fg-3">{excluded.length ? `${excluded.length} excluded` : "Copy everything"}</span>
            </div>
            {excluded.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {excluded.map((s) => (
                  <ToggleChip key={s} tone="down" on onClick={() => setExcluded((x) => x.filter((y) => y !== s))}>
                    <SymbolAvatar symbol={s} size={16} />
                    {s}
                    <XIcon className="size-3" />
                  </ToggleChip>
                ))}
              </div>
            )}
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbols" leading={<Search />} className="mb-2 h-9" />
            <div className="flex flex-wrap gap-2">
              {symbolsQ.loading && !suggested.length && <span className="text-[12px] text-fg-3">Loading symbols…</span>}
              {symbolsQ.error && !ordered.length && <span className="text-[12px] text-fg-3">Symbols are unavailable right now.</span>}
              {shown
                .filter((s) => !excluded.includes(s))
                .map((s) => (
                  <ToggleChip key={s} tone="down" on={false} onClick={() => setExcluded((x) => [...x, s])}>
                    <SymbolAvatar symbol={s} size={16} />
                    {s}
                  </ToggleChip>
                ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field label="Amount to allocate from your wallet" hint={`Min ${usd(m.minAllocation, 0)}`} error={allocation.raw ? allocErr : undefined}>
            <Input type="number" inputMode="decimal" min={m.minAllocation} value={allocation.raw} onChange={(e) => allocation.setRaw(e.target.value)} leading="$" trailing="USD" inputClassName="k-num text-[16px] font-medium" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[m.minAllocation, 500, 1000, 2500, 5000]
              .filter((v, i, arr) => v >= m.minAllocation && v > 0 && arr.indexOf(v) === i)
              .map((v) => (
                <ToggleChip key={v} on={alloc === v} onClick={() => allocation.set(v)}>
                  {usd(v, 0)}
                </ToggleChip>
              ))}
          </div>
          <InfoBox tone="gold">
            A new copy account is opened for this subscription and {alloc > 0 ? usd(alloc) : "the amount"} moves into it from your wallet. Later deposits and withdrawals on the copy account adjust your high-water mark, so fees are only charged on trading profit.
          </InfoBox>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[16px] border border-ember/30 bg-ember-soft px-5 py-4 text-[14px]">
            <ShieldCheck className="size-5 shrink-0 text-ember" />A dedicated copy account will be opened on Kalks-Live and funded from your wallet.
          </div>
          <KeyValue
            rows={[
              ["Master", `${m.nickname} · ${m.strategy}`],
              ["Sizing", mode === "equity" ? SIZING_LABEL.equity : sizingText({ mode, value: val })],
              ["Allocation", usd(alloc)],
              ["Max drawdown stop", ddOn ? `-${dd}% from peak equity` : "Off"],
              ["Equity stop", equityStop.value !== null ? usd(equityStop.value) : "Off"],
              ["Max lot", maxLot.value !== null ? `${maxLot.value.toFixed(2)} lots` : "No cap"],
              ["Excluded symbols", excluded.length ? excluded.join(", ") : "None"],
              ["Performance fee", `${m.perfFeePct}% above high-water mark · settled ${PERIOD_LABEL[m.feePeriod].toLowerCase()}`],
            ]}
          />
          <InfoBox>
            Opens, adds, partial closes, SL/TP changes and pending orders are mirrored. Copied trades can&apos;t be closed or modified one by one; to exit, stop copying and everything closes at market. The fee rate is locked for this subscription and is taken from the copy account when the period ends.
          </InfoBox>
          <Checkbox checked={agree} onChange={setAgree}>
            I understand copy trading carries risk, past results don&apos;t guarantee future returns, and I accept the master&apos;s fee terms.
          </Checkbox>
        </div>
      )}
    </Dialog>
  );
}
