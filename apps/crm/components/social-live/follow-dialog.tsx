"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Coins, Layers, Loader2, Percent, Scale, Search, ShieldCheck, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, Field, Input, KeyValue, Stepper, SymbolAvatar, Toggle, cn } from "@kalks/ui";
import { Trans, useT } from "@kalks/i18n/react";
import { Checkbox, RadioCard, RangeSlider, ToggleChip } from "@/components/social/controls";
import { TradeButton } from "@/components/trading/ui";
import { ApiError, PERIOD_LABEL, SIZING_LABEL, sizingText, socialApi, usd, useSocial, type FollowResult, type MasterView, type SizingMode } from "./api";
import { HouseBadge, InfoBox, MasterIdentity, RiskBadge, useNumber } from "./bits";

// Step label keys, translated at render
const STEPS = ["social.follow.step.sizing", "social.follow.step.risk", "social.follow.step.amount", "social.follow.step.review"] as const;

const MODES = [
  { key: "equity", icon: <Scale />, text: "social.follow.mode.equity" },
  { key: "fixed_lot", icon: <Layers />, text: "social.follow.mode.fixedLot" },
  { key: "multiplier", icon: <Percent />, text: "social.follow.mode.multiplier" },
  { key: "allocation", icon: <Coins />, text: "social.follow.mode.allocation" },
] as const satisfies readonly { key: SizingMode; text: string; icon: React.ReactNode }[];

/** Follower lot for a 1.00-lot master trade (rounded down to 0.01, capped by max lot). */
function exampleLot(mode: SizingMode, value: number, allocation: number, masterEquity: number, maxLot: number | null) {
  const me = masterEquity > 0 ? masterEquity : 0;
  let v = mode === "equity" ? (me ? allocation / me : 0) : mode === "allocation" ? (me ? value / me : 0) : mode === "multiplier" ? value : value;
  v = Math.floor(v * 100 + 1e-9) / 100;
  if (maxLot && v > maxLot) v = maxLot;
  return v;
}

export function FollowDialog({ master: m, open, onOpenChange, suggested = [], onDone }: { master: MasterView | null; open: boolean; onOpenChange: (o: boolean) => void; suggested?: string[]; onDone?: () => void }) {
  const t = useT();
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

  const sizingErr = mode === "equity" ? undefined : !(val > 0) ? t("social.follow.err.aboveZero") : mode === "fixed_lot" && val < 0.01 ? t("social.follow.err.minLot") : undefined;
  const allocErr = !(alloc > 0) ? t("social.follow.err.enterAmount") : alloc < m.minAllocation ? t("social.follow.err.minAllocation", { amount: usd(m.minAllocation, 0) }) : undefined;
  const maxLotErr = maxLot.raw && !(maxLot.value! >= 0.01) ? t("social.follow.err.minLot") : undefined;
  const stopErr = equityStop.raw && !(equityStop.value! >= 0) ? t("social.follow.err.enterAmount") : equityStop.value !== null && alloc > 0 && equityStop.value >= alloc ? t("social.follow.err.belowAllocation") : undefined;

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
      if (r.funding?.status === "done") toast.success(t("social.follow.nowCopying", { name: m.nickname }), { description: t("social.follow.toast.fundedDesc", { login: r.account?.login ?? r.subscription.login, amount: usd(alloc) }) });
      else toast.warning(t("social.follow.toast.createdTitle", { login: r.account?.login ?? r.subscription.login }), { description: t("social.follow.toast.createdDesc") });
      onDone?.();
    } catch (e) {
      toast.error(t("social.follow.toast.failed"), { description: e instanceof ApiError || e instanceof Error ? e.message : undefined });
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
        title={ok ? t("social.follow.nowCopying", { name: m.nickname }) : t("social.follow.done.createdTitle")}
        description={t("social.follow.done.description", { login })}
        footer={
          <>
            <Link href="/social/copy">
              <Button variant="surface" onClick={() => onOpenChange(false)}>
                {t("social.mySubscriptions")}
              </Button>
            </Link>
            <TradeButton a={{ login, status: "active" }} size="md" label={t("social.openInTrader")} />
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
                  <Trans k="social.follow.done.okText" vars={{ amount: usd(alloc), login, name: m.nickname }} tags={{ acc: (c) => <span className="font-mono text-fg">{c}</span> }} />
                </>
              ) : (
                <>
                  <Trans k="social.follow.done.failText" vars={{ login }} tags={{ acc: (c) => <span className="font-mono text-fg">{c}</span> }} />
                  {result.funding?.message ? <>: {result.funding.message}</> : "."} {t("social.follow.done.failHint")}
                </>
              )}
            </div>
          </div>
          <InfoBox>{t("social.follow.done.exitNote")}</InfoBox>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={680}
      title={t("social.follow.title", { name: m.nickname })}
      description={t("social.follow.description")}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))} disabled={busy}>
            {step === 0 ? (
              t("common.cancel")
            ) : (
              <>
                <ArrowLeft className="rtl:-scale-x-100" /> {t("common.back")}
              </>
            )}
          </Button>
          <Button variant="ember" size="md" onClick={next} disabled={busy || (step === 3 && !agree)}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {step === 3 ? (
              t("social.follow.confirm")
            ) : (
              <>
                {t("common.continue")} <ArrowRight className="rtl:-scale-x-100" />
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3">
        <MasterIdentity nickname={m.nickname} size={38} sub={t("social.follow.masterSub", { strategy: m.strategy, fee: m.perfFeePct, min: usd(m.minAllocation, 0) })} />
        <span className="flex flex-wrap items-center gap-1.5">
          {m.house && <HouseBadge />}
          <RiskBadge risk={m.stats.riskScore} showLabel />
        </span>
      </div>
      {m.house && <InfoBox className="-mt-2 mb-5">{t("social.house.disclosure")}</InfoBox>}
      <Stepper steps={STEPS.map((k) => t(k))} current={step} className="mb-6" />

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
                text={t(s.text)}
                icon={s.icon}
              />
            ))}
          </div>
          {mode !== "equity" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={mode === "fixed_lot" ? t("social.follow.lotPerTrade") : mode === "multiplier" ? t("social.sizing.multiplier") : t("social.follow.allocForSizing")} error={sizingErr}>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={mode === "fixed_lot" ? 0.01 : mode === "multiplier" ? 0.1 : 50}
                  min={0}
                  value={value.raw}
                  onChange={(e) => value.setRaw(e.target.value)}
                  leading={mode === "allocation" ? "$" : undefined}
                  trailing={mode === "fixed_lot" ? t("social.lotsUnit") : mode === "multiplier" ? "×" : "USD"}
                  inputClassName="k-num"
                />
              </Field>
            </div>
          )}
          <InfoBox tone="gold">
            {masterEq > 0 ? (
              <>
                <Trans k="social.follow.example.lead" vars={{ name: m.nickname, equity: usd(masterEq, 0), lot: lot.toFixed(2) }} tags={{ b: (c) => <b className="text-fg">{c}</b>, lot: (c) => <b className="k-num text-ember">{c}</b> }} />
                {mode === "equity" && <> {t("social.follow.example.equity", { alloc: usd(alloc, 0), equity: usd(masterEq, 0) })}</>}
                {mode === "allocation" && <> ({usd(val, 0)} ÷ {usd(masterEq, 0)})</>}
                {mode === "multiplier" && <> (1.00 × {val})</>}
                {maxLot.value !== null && lot === maxLot.value && <>{t("social.follow.example.capped")}</>}. {t("social.follow.example.rounding")}
              </>
            ) : (
              <>{t("social.follow.example.roundingLogged")}</>
            )}
          </InfoBox>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="rounded-[16px] border border-line bg-surface-2 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">{t("social.follow.ddStop")}</div>
                <div className="text-[12px] text-fg-3">{t("social.follow.ddStopHint")}</div>
              </div>
              <Toggle checked={ddOn} onChange={setDdOn} label={t("social.follow.ddStop")} />
            </div>
            <div className={cn("mt-4", !ddOn && "pointer-events-none opacity-40")}>
              <div className="mb-1 flex justify-between text-[12.5px]">
                <span className="text-fg-3">{t("social.follow.trigger")}</span>
                <span className="k-num font-medium text-down">{t("social.follow.fromPeak", { dd })}</span>
              </div>
              <RangeSlider value={dd} onChange={setDd} min={5} max={90} step={1} tone="down" ticks={[5, 20, 30, 50, 90]} format={(v) => `${v}%`} label={t("social.follow.maxDrawdown")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("social.equityStop")} hint={t("social.follow.optionalUsd")} error={stopErr}>
              <Input type="number" inputMode="decimal" min={0} placeholder={t("social.follow.noEquityStop")} value={equityStop.raw} onChange={(e) => equityStop.setRaw(e.target.value)} leading="$" inputClassName="k-num" />
            </Field>
            <Field label={t("social.follow.maxLotPerTrade")} hint={t("common.optional")} error={maxLotErr}>
              <Input type="number" inputMode="decimal" step={0.01} min={0.01} placeholder={t("social.noCap")} value={maxLot.raw} onChange={(e) => maxLot.setRaw(e.target.value)} trailing={t("social.lotsUnit")} inputClassName="k-num" />
            </Field>
          </div>
          <p className="-mt-3 text-[12px] text-fg-3">{t("social.follow.limitsNote")}</p>
          <div>
            <div className="mb-2 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
              {t("social.follow.excludeSymbols")}
              <span className="font-normal text-fg-3">{excluded.length ? t("social.follow.excludedCount", { count: excluded.length }) : t("social.follow.copyEverything")}</span>
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("social.follow.searchSymbols")} leading={<Search />} className="mb-2 h-9" />
            <div className="flex flex-wrap gap-2">
              {symbolsQ.loading && !suggested.length && <span className="text-[12px] text-fg-3">{t("social.follow.loadingSymbols")}</span>}
              {symbolsQ.error && !ordered.length && <span className="text-[12px] text-fg-3">{t("social.follow.symbolsUnavailable")}</span>}
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
          <Field label={t("social.follow.amountLabel")} hint={t("social.minAmount", { amount: usd(m.minAllocation, 0) })} error={allocation.raw ? allocErr : undefined}>
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
            {t("social.follow.amountNote", { amount: alloc > 0 ? usd(alloc) : t("social.follow.theAmount") })}
          </InfoBox>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[16px] border border-ember/30 bg-ember-soft px-5 py-4 text-[14px]">
            <ShieldCheck className="size-5 shrink-0 text-ember" />{t("social.follow.reviewBanner")}
          </div>
          <KeyValue
            rows={[
              [t("social.master"), `${m.nickname} · ${m.strategy}`],
              [t("social.follow.step.sizing"), mode === "equity" ? SIZING_LABEL.equity : sizingText({ mode, value: val })],
              [t("social.allocation"), usd(alloc)],
              [t("social.follow.ddStop"), ddOn ? t("social.follow.fromPeakEquity", { dd }) : t("common.off")],
              [t("social.equityStop"), equityStop.value !== null ? usd(equityStop.value) : t("common.off")],
              [t("social.maxLot"), maxLot.value !== null ? t("social.lotsValue", { lots: maxLot.value.toFixed(2) }) : t("social.noCap")],
              [t("social.follow.excludedSymbols"), excluded.length ? excluded.join(", ") : t("common.none")],
              [t("social.performanceFee"), t("social.follow.feeTerms", { fee: m.perfFeePct, period: PERIOD_LABEL[m.feePeriod].toLowerCase() })],
            ]}
          />
          <InfoBox>
            {t("social.follow.mirrorNote")}
          </InfoBox>
          <Checkbox checked={agree} onChange={setAgree}>
            {t("social.follow.agree")}
          </Checkbox>
        </div>
      )}
    </Dialog>
  );
}
