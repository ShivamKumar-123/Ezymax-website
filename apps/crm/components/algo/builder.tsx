"use client";

// Visual strategy builder for the live ALGO service: rule sets (groups of conditions) for buy / sell entries and
// exits, and the risk / session settings. Edits a StrategySpec (services/algo/src/spec.rs).

import * as React from "react";
import { Check, ChevronDown, Plus, Repeat2, Trash2, X } from "lucide-react";
import { Menu, Segmented, SymbolAvatar, Toggle, cn } from "@/components/kit";
import { useT } from "@kalks/i18n/react";
import { operand, type Condition, type Meta, type Operand, type RuleSet, type StrategySpec } from "./api";

type Tone = "ember" | "gold" | "up" | "down" | "info" | "neutral";

const TONE: Record<Tone, { chip: string; bar: string; label: string }> = {
  ember: { chip: "border-ember/30 bg-ember-soft text-ember hover:border-ember/60", bar: "bg-ember", label: "text-ember" },
  gold: { chip: "border-gold/30 bg-gold-soft text-gold hover:border-gold/60", bar: "bg-gold", label: "text-gold" },
  up: { chip: "border-up/30 bg-up-soft text-up hover:border-up/60", bar: "bg-up", label: "text-up" },
  down: { chip: "border-down/30 bg-down-soft text-down hover:border-down/60", bar: "bg-down", label: "text-down" },
  info: { chip: "border-info/30 bg-info-soft text-info hover:border-info/60", bar: "bg-info", label: "text-info" },
  neutral: { chip: "border-line bg-surface-3 text-fg hover:border-[var(--k-border-top)]", bar: "bg-fg-3", label: "text-fg-2" },
};

const chipBase = "inline-flex h-8 items-center gap-1 rounded-[10px] border px-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ember/40";

export function NumInput({ value, onChange, step = 1, min, label, className, suffix, width }: { value: number; onChange: (v: number) => void; step?: number; min?: number; label: string; className?: string; suffix?: string; width?: number }) {
  const [txt, setTxt] = React.useState(String(value));
  React.useEffect(() => setTxt(String(value)), [value]);
  return (
    <span className={cn("inline-flex items-center", className)}>
      <input
        value={txt}
        inputMode="decimal"
        aria-label={label}
        onChange={(e) => {
          setTxt(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(min !== undefined ? Math.max(min, n) : n);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const n = +(value + (e.key === "ArrowUp" ? step : -step)).toFixed(6);
            onChange(min !== undefined ? Math.max(min, n) : n);
          }
        }}
        onBlur={() => setTxt(String(value))}
        style={{ width: width ? `${width}px` : `${Math.max(2, txt.length) + 1.5}ch` }}
        className="k-num h-6 rounded-md bg-black/25 light:bg-surface-2 px-1 text-center text-[12.5px] text-fg outline-none focus:ring-1 focus:ring-current"
      />
      {suffix && <span className="ms-1 opacity-80">{suffix}</span>}
    </span>
  );
}

function Pick<T extends string>({ value, options, onChange, tone = "neutral", width = 220, label, children }: { value: T; options: { value: T; label: React.ReactNode; hint?: React.ReactNode }[]; onChange: (v: T) => void; tone?: Tone; width?: number; label: string; children?: React.ReactNode }) {
  const cur = options.find((o) => o.value === value);
  return (
    <Menu
      align="start"
      width={width}
      trigger={
        <button type="button" aria-label={label} className={cn(chipBase, TONE[tone].chip)}>
          {children ?? cur?.label ?? value}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      }
      items={options.map((o) => ({ label: o.label, hint: o.value === value ? <Check className="size-3.5 text-ember" /> : o.hint, onSelect: () => onChange(o.value) }))}
    />
  );
}

const OP_LABEL: Record<string, string> = { gt: ">", lt: "<", gte: "≥", lte: "≤", crosses_above: "crosses above", crosses_below: "crosses below" };
const FIELD_LABEL: Record<string, string> = { close: "Close", open: "Open", high: "High", low: "Low", hl2: "HL/2", hlc3: "HLC/3", ohlc4: "OHLC/4" };
const PATTERN_LABEL = (p: string) => p.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const TWO_PERIODS: Record<string, string> = { macd: "slow", macd_signal: "slow", macd_hist: "slow", stoch_k: "%D", stoch_d: "%D", adx: "smooth", plus_di: "smooth", minus_di: "smooth" };
type Tr = ReturnType<typeof useT>;
// Enum labels: translated when a catalog key exists, otherwise the symbol / English fallback above.
const opLabel = (t: Tr, o: string) => t.dyn(`developer.op.${o}`, OP_LABEL[o] ?? o);
const fieldLabel = (t: Tr, f: string) => t.dyn(`developer.field.${f}`, FIELD_LABEL[f] ?? f);
const patternLabel = (t: Tr, p: string) => t.dyn(`developer.pattern.${p}`, PATTERN_LABEL(p));
const NO_SOURCE = ["atr", "stoch_k", "stoch_d", "highest", "lowest", "willr", "adx", "plus_di", "minus_di"];

function OperandChip({ o, onChange, tone, meta, side }: { o: Operand; onChange: (o: Operand) => void; tone: Tone; meta: Meta; side: "left" | "right" }) {
  const t = useT();
  const ind = meta.indicators.find((i) => i.key === o.indicator);
  const kindItems = [
    ...meta.priceFields.map((f) => ({ label: `${t("developer.builder.price")} · ${fieldLabel(t, f)}`, hint: o.kind === "price" && o.field === f ? <Check className="size-3.5 text-ember" /> : undefined, onSelect: () => onChange(operand({ kind: "price", field: f })) })),
    "sep" as const,
    ...meta.indicators.map((d) => ({
      label: d.label,
      hint: o.kind === "indicator" && o.indicator === d.key ? <Check className="size-3.5 text-ember" /> : undefined,
      onSelect: () => onChange(operand({ kind: "indicator", indicator: d.key, period: d.period, period2: d.period2, period3: d.period3, mult: d.mult })),
    })),
    "sep" as const,
    { label: t("developer.builder.value"), hint: o.kind === "value" ? <Check className="size-3.5 text-ember" /> : undefined, onSelect: () => onChange(operand({ kind: "value", value: o.kind === "value" ? o.value : 50 })) },
    ...(side === "left" ? meta.patterns.map((p) => ({ label: `${t("developer.builder.candle")} · ${patternLabel(t, p)}`, hint: o.kind === "candle" && o.pattern === p ? <Check className="size-3.5 text-ember" /> : undefined, onSelect: () => onChange(operand({ kind: "candle", pattern: p })) })) : []),
  ];
  const title = o.kind === "value" ? t("developer.builder.value") : o.kind === "price" ? fieldLabel(t, o.field) : o.kind === "candle" ? patternLabel(t, o.pattern) : ind?.label ?? o.indicator;
  return (
    <span className={cn(chipBase, TONE[tone].chip, "gap-0 pe-1.5")}>
      <Menu
        align="start"
        width={260}
        trigger={
          <button type="button" className="inline-flex h-full items-center gap-1 outline-none" aria-label={side === "left" ? t("developer.builder.leftOperand") : t("developer.builder.rightOperand")}>
            {title}
            <ChevronDown className="size-3 opacity-60" />
          </button>
        }
        items={kindItems}
      />
      {o.kind === "value" && <NumInput className="ms-1" label={t("developer.builder.constant")} value={o.value} step={Math.abs(o.value) < 5 ? 0.0001 : 1} onChange={(v) => onChange({ ...o, value: v })} />}
      {o.kind === "indicator" && (
        <span className="ms-0.5 inline-flex items-center gap-0.5" dir="ltr">
          (<NumInput label={t("developer.builder.period")} value={o.period} min={1} onChange={(v) => onChange({ ...o, period: Math.max(1, Math.round(v)) })} />
          {TWO_PERIODS[o.indicator] && (
            <>
              ,<NumInput label={t.dyn(`developer.period2.${TWO_PERIODS[o.indicator]}`, TWO_PERIODS[o.indicator])} value={o.period2} min={1} onChange={(v) => onChange({ ...o, period2: Math.max(1, Math.round(v)) })} />
            </>
          )}
          {o.indicator.startsWith("macd") && (
            <>
              ,<NumInput label={t("developer.builder.signal")} value={o.period3} min={1} onChange={(v) => onChange({ ...o, period3: Math.max(1, Math.round(v)) })} />
            </>
          )}
          {o.indicator.startsWith("bb_") && (
            <>
              ,<NumInput label={t("developer.builder.deviations")} value={o.mult} step={0.1} min={0.1} onChange={(v) => onChange({ ...o, mult: v })} />
            </>
          )}
          )
          {!NO_SOURCE.includes(o.indicator) && o.field !== "close" && <span className="ms-1 text-[11px] opacity-70">{t("developer.builder.ofField", { field: fieldLabel(t, o.field) })}</span>}
        </span>
      )}
    </span>
  );
}

const PRESETS: { label: string; key?: "developer.preset.emaCross" | "developer.preset.closeSma" | "developer.preset.macdCross" | "developer.preset.breakHigh" | "developer.preset.bbLower" | "developer.preset.engulfing"; make: () => Condition }[] = [
  { label: "EMA(20) crosses above EMA(50)", key: "developer.preset.emaCross", make: () => ({ left: operand({ kind: "indicator", indicator: "ema", period: 20 }), op: "crosses_above", right: operand({ kind: "indicator", indicator: "ema", period: 50 }), timeframe: "same" }) },
  { label: "RSI(14) < 30", make: () => ({ left: operand({ kind: "indicator", indicator: "rsi", period: 14 }), op: "lt", right: operand({ kind: "value", value: 30 }), timeframe: "same" }) },
  { label: "Close > SMA(200)", key: "developer.preset.closeSma", make: () => ({ left: operand({ kind: "price", field: "close" }), op: "gt", right: operand({ kind: "indicator", indicator: "sma", period: 200 }), timeframe: "same" }) },
  { label: "MACD crosses above signal", key: "developer.preset.macdCross", make: () => ({ left: operand({ kind: "indicator", indicator: "macd", period: 12, period2: 26, period3: 9 }), op: "crosses_above", right: operand({ kind: "indicator", indicator: "macd_signal", period: 12, period2: 26, period3: 9 }), timeframe: "same" }) },
  { label: "Close breaks 20-bar high", key: "developer.preset.breakHigh", make: () => ({ left: operand({ kind: "price", field: "close" }), op: "crosses_above", right: operand({ kind: "indicator", indicator: "highest", period: 20 }), timeframe: "same" }) },
  { label: "Close < Bollinger lower", key: "developer.preset.bbLower", make: () => ({ left: operand({ kind: "price", field: "close" }), op: "lt", right: operand({ kind: "indicator", indicator: "bb_lower", period: 20, mult: 2 }), timeframe: "same" }) },
  { label: "ADX(14) > 25", make: () => ({ left: operand({ kind: "indicator", indicator: "adx", period: 14, period2: 14 }), op: "gt", right: operand({ kind: "value", value: 25 }), timeframe: "same" }) },
  { label: "Bullish engulfing candle", key: "developer.preset.engulfing", make: () => ({ left: operand({ kind: "candle", pattern: "bullish_engulfing" }), op: "gte", right: operand({ kind: "value", value: 1 }), timeframe: "same" }) },
];

function ConditionRow({ c, onChange, onRemove, tone, meta, baseTf }: { c: Condition; onChange: (c: Condition) => void; onRemove: () => void; tone: Tone; meta: Meta; baseTf: string }) {
  const t = useT();
  const higher = meta.timeframes.slice(meta.timeframes.indexOf(baseTf) + 1);
  return (
    <div className="group flex flex-wrap items-center gap-1.5 rounded-[12px] px-1 py-1 text-[13px] text-fg-3 hover:bg-surface-2/60">
      <OperandChip o={c.left} onChange={(left) => onChange({ ...c, left })} tone={tone} meta={meta} side="left" />
      {c.left.kind === "candle" ? (
        <span className="px-1 text-fg-3">{t("developer.builder.isPresent")}</span>
      ) : (
        <>
          <Pick label={t("developer.builder.operator")} value={c.op} onChange={(op) => onChange({ ...c, op })} options={meta.operators.map((o) => ({ value: o, label: opLabel(t, o) }))} width={180} />
          <OperandChip o={c.right} onChange={(right) => onChange({ ...c, right })} tone="neutral" meta={meta} side="right" />
        </>
      )}
      <Pick
        label={t("developer.builder.timeframe")}
        value={c.timeframe}
        onChange={(timeframe) => onChange({ ...c, timeframe })}
        tone={c.timeframe === "same" ? "neutral" : "info"}
        width={170}
        options={[{ value: "same", label: t("developer.builder.thisTimeframe", { tf: baseTf }) }, ...higher.map((tf) => ({ value: tf, label: t("developer.builder.onTimeframe", { tf }), hint: t("developer.builder.higherTimeframe") }))]}
      >
        <span className="font-mono text-[11.5px]">{c.timeframe === "same" ? baseTf : c.timeframe}</span>
      </Pick>
      <button type="button" onClick={onRemove} className="ms-auto grid size-7 shrink-0 place-items-center rounded-full text-fg-3 opacity-60 transition hover:bg-down-soft hover:text-down group-hover:opacity-100" aria-label={t("developer.builder.removeCondition")}>
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function RuleSetEditor({ title, sub, tone, rs, onChange, meta, baseTf }: { title: string; sub: string; tone: Tone; rs: RuleSet; onChange: (r: RuleSet) => void; meta: Meta; baseTf: string }) {
  const t = useT();
  const setGroup = (gi: number, patch: Partial<RuleSet["groups"][number]>) => onChange({ ...rs, groups: rs.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  const add = (gi: number | null, c: Condition) => {
    if (gi === null || !rs.groups[gi]) onChange({ ...rs, groups: [...rs.groups, { logic: "all", conditions: [c] }] });
    else setGroup(gi, { conditions: [...rs.groups[gi]!.conditions, c] });
  };
  const addMenu = (gi: number | null, label: string) => (
    <Menu
      align="start"
      width={260}
      trigger={
        <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12px] text-fg-2 transition hover:border-ember/50 hover:text-ember">
          <Plus className="size-3.5" /> {label}
        </button>
      }
      items={PRESETS.map((p) => ({ label: p.key ? t(p.key) : p.label, onSelect: () => add(gi, p.make()) }))}
    />
  );
  return (
    <div className="k-row relative overflow-hidden py-3 ps-5 pe-3">
      <span className={cn("absolute inset-y-0 start-0 w-[3px]", TONE[tone].bar)} />
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn("text-[11.5px] font-semibold uppercase tracking-[0.08em]", TONE[tone].label)}>{title}</div>
        <div className="text-[11px] text-fg-3">{sub}</div>
        {rs.groups.length > 1 && (
          <button type="button" onClick={() => onChange({ ...rs, logic: rs.logic === "all" ? "any" : "all" })} className="ms-auto inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-fg-2 hover:border-gold/50 hover:text-gold">
            {rs.logic === "all" ? t("developer.builder.groupsAll") : t("developer.builder.groupsAny")} <Repeat2 className="size-3" />
          </button>
        )}
      </div>
      {rs.groups.length === 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
          <span>{t("developer.builder.noRule")}</span>
          {addMenu(null, t("developer.builder.addCondition"))}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {rs.groups.map((g, gi) => (
            <div key={gi} className="rounded-[12px] border border-line/70 bg-surface-2/30 p-2">
              {rs.groups.length > 1 && (
                <div className="mb-1 flex items-center gap-2 px-1 text-[10.5px] uppercase tracking-wider text-fg-3">
                  {t("developer.builder.group", { n: gi + 1 })}
                  <button type="button" className="ms-auto grid size-6 place-items-center rounded-full hover:bg-down-soft hover:text-down" aria-label={t("developer.builder.removeGroup")} onClick={() => onChange({ ...rs, groups: rs.groups.filter((_, i) => i !== gi) })}>
                    <X className="size-3" />
                  </button>
                </div>
              )}
              {g.conditions.map((c, ci) => (
                <React.Fragment key={ci}>
                  {ci > 0 && (
                    <button type="button" onClick={() => setGroup(gi, { logic: g.logic === "all" ? "any" : "all" })} className="ms-3 inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-fg-2 transition hover:border-gold/50 hover:text-gold">
                      {g.logic === "all" ? t("developer.builder.and") : t("developer.builder.or")} <Repeat2 className="size-3" />
                    </button>
                  )}
                  <ConditionRow
                    c={c}
                    meta={meta}
                    tone={tone}
                    baseTf={baseTf}
                    onChange={(nc) => setGroup(gi, { conditions: g.conditions.map((x, i) => (i === ci ? nc : x)) })}
                    onRemove={() => {
                      const conditions = g.conditions.filter((_, i) => i !== ci);
                      if (conditions.length) setGroup(gi, { conditions });
                      else onChange({ ...rs, groups: rs.groups.filter((_, i) => i !== gi) });
                    }}
                  />
                </React.Fragment>
              ))}
              <div className="mt-1 px-1">{addMenu(gi, g.logic === "all" ? t("developer.builder.andMore") : t("developer.builder.orMore"))}</div>
            </div>
          ))}
          <div>{addMenu(null, t("developer.builder.addOrGroup"))}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const DIST_LABEL: Record<string, string> = { none: "Off", points: "Points", pips: "Pips", price: "Price distance", percent: "% of entry", atr: "× ATR", level: "Fixed level", rr: "× stop (R)" };
const TRAIL_LABEL: Record<string, string> = { none: "Off", points: "Points", pips: "Pips", atr: "× ATR" };
const DAYS = ["developer.day.sun", "developer.day.mon", "developer.day.tue", "developer.day.wed", "developer.day.thu", "developer.day.fri", "developer.day.sat"] as const;

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] text-fg">{label}</div>
        {hint && <div className="text-[11px] text-fg-3">{hint}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-3">{children}</div>
    </div>
  );
}

export function SettingsEditor({ spec, onChange, meta }: { spec: StrategySpec; onChange: (s: StrategySpec) => void; meta: Meta }) {
  const t = useT();
  const set = (p: Partial<StrategySpec>) => onChange({ ...spec, ...p });
  const dist = (key: "sl" | "tp") => {
    const d = spec[key];
    const modes = meta.distanceModes.filter((m) => key === "tp" || m !== "rr");
    return (
      <>
        <Pick label={key === "sl" ? t("developer.builder.slMode") : t("developer.builder.tpMode")} value={d.mode} onChange={(mode) => set({ [key]: { ...d, mode } } as Partial<StrategySpec>)} options={modes.map((m) => ({ value: m, label: t.dyn(`developer.dist.${m}`, DIST_LABEL[m] ?? m) }))} width={180} tone={d.mode === "none" ? "neutral" : key === "sl" ? "down" : "up"} />
        {d.mode !== "none" && <NumInput label={key === "sl" ? t("developer.builder.slValue") : t("developer.builder.tpValue")} value={d.value} min={0} step={d.mode === "price" || d.mode === "level" ? 0.0001 : d.mode === "rr" || d.mode === "atr" ? 0.1 : 1} onChange={(value) => set({ [key]: { ...d, value } } as Partial<StrategySpec>)} />}
        {d.mode === "atr" && <NumInput label={t("developer.builder.atrPeriod")} value={d.atrPeriod} min={1} onChange={(atrPeriod) => set({ [key]: { ...d, atrPeriod: Math.round(atrPeriod) } } as Partial<StrategySpec>)} suffix={t("developer.unit.bars")} />}
      </>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
      <div>
        <Row label={t("developer.builder.positionSize")} hint={spec.sizing.mode === "risk" ? t("developer.builder.riskHint") : t("developer.builder.lotsHint")}>
          <Segmented size="sm" value={spec.sizing.mode} onChange={(mode) => set({ sizing: { ...spec.sizing, mode } })} options={[{ value: "lots", label: t("developer.builder.lots") }, { value: "risk", label: t("developer.builder.riskPct") }]} />
          {spec.sizing.mode === "lots" ? (
            <NumInput label={t("developer.builder.lots")} value={spec.sizing.lots} step={0.01} min={0} onChange={(lots) => set({ sizing: { ...spec.sizing, lots } })} suffix={t("developer.unit.lot")} />
          ) : (
            <NumInput label={t("developer.builder.riskPct")} value={spec.sizing.riskPct} step={0.1} min={0} onChange={(riskPct) => set({ sizing: { ...spec.sizing, riskPct } })} suffix="%" />
          )}
        </Row>
        <Row label={t("developer.builder.maxLotsPerOrder")} hint={t("developer.builder.maxLotsHint")}>
          <NumInput label={t("developer.builder.maxLots")} value={spec.maxLots} step={0.01} min={0} onChange={(maxLots) => set({ maxLots })} suffix={t("developer.unit.lot")} />
        </Row>
        <Row label={t("developer.builder.stopLoss")}>{dist("sl")}</Row>
        <Row label={t("developer.builder.takeProfit")}>{dist("tp")}</Row>
        <Row label={t("developer.builder.trailingStop")} hint={t("developer.builder.trailingHint")}>
          <Pick label={t("developer.builder.trailingMode")} value={spec.trailing.mode} onChange={(mode) => set({ trailing: { ...spec.trailing, mode } })} options={meta.trailModes.map((m) => ({ value: m, label: t.dyn(`developer.dist.${m}`, TRAIL_LABEL[m] ?? m) }))} width={160} tone={spec.trailing.mode === "none" ? "neutral" : "gold"} />
          {spec.trailing.mode !== "none" && <NumInput label={t("developer.builder.trailingDistance")} value={spec.trailing.value} min={0} step={spec.trailing.mode === "atr" ? 0.1 : 1} onChange={(value) => set({ trailing: { ...spec.trailing, value } })} />}
        </Row>
        <Row label={t("developer.builder.breakeven")} hint={t("developer.builder.breakevenHint")}>
          <NumInput label={t("developer.builder.breakevenTrigger")} value={spec.trailing.breakevenTrigger} min={0} onChange={(breakevenTrigger) => set({ trailing: { ...spec.trailing, breakevenTrigger } })} suffix={t("developer.unit.pts")} />
          <span>+</span>
          <NumInput label={t("developer.builder.breakevenOffset")} value={spec.trailing.breakevenOffset} onChange={(breakevenOffset) => set({ trailing: { ...spec.trailing, breakevenOffset } })} suffix={t("developer.unit.pts")} />
        </Row>
      </div>
      <div>
        <Row label={t("developer.builder.tradingWindow")} hint={t("developer.builder.tradingWindowHint")}>
          {spec.sessions.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-[10px] border border-line bg-surface-2 px-2 py-1 font-mono text-[12px] text-fg-2" dir="ltr">
              <input aria-label={t("developer.builder.sessionStart")} value={w.start} onChange={(e) => set({ sessions: spec.sessions.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })} className="w-[5ch] bg-transparent text-center outline-none" />–
              <input aria-label={t("developer.builder.sessionEnd")} value={w.end} onChange={(e) => set({ sessions: spec.sessions.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })} className="w-[5ch] bg-transparent text-center outline-none" />
              <button type="button" aria-label={t("developer.builder.removeWindow")} onClick={() => set({ sessions: spec.sessions.filter((_, j) => j !== i) })} className="text-fg-3 hover:text-down">
                <X className="size-3" />
              </button>
            </span>
          ))}
          {spec.sessions.length < 4 && (
            <button type="button" onClick={() => set({ sessions: [...spec.sessions, { start: "08:00", end: "17:00" }] })} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12px] text-fg-2 hover:border-ember/50 hover:text-ember">
              <Plus className="size-3.5" /> {t("developer.builder.window")}
            </button>
          )}
        </Row>
        <Row label={t("developer.builder.days")} hint={t("developer.builder.daysHint")}>
          {DAYS.map((d, i) => {
            const on = spec.days.includes(i);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => set({ days: on ? spec.days.filter((x) => x !== i) : [...spec.days, i].sort() })} className={cn("h-7 rounded-full border px-2 text-[11.5px] transition", on ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg")}>
                {t(d)}
              </button>
            );
          })}
        </Row>
        <Row label={t("developer.builder.closeOutside")}>
          <Toggle checked={spec.closeOutsideSession} onChange={(closeOutsideSession) => set({ closeOutsideSession })} label={t("developer.builder.closeOutsideAria")} />
        </Row>
        <Row label={t("developer.builder.maxTradesPerDay")} hint={t("developer.builder.maxTradesHint")}>
          <NumInput label={t("developer.builder.maxTradesPerDay")} value={spec.maxTradesPerDay} min={0} onChange={(v) => set({ maxTradesPerDay: Math.round(v) })} />
        </Row>
        <Row label={t("developer.builder.maxDailyLoss")} hint={t("developer.builder.maxDailyLossHint")}>
          <NumInput label={t("developer.builder.maxDailyLoss")} value={spec.maxDailyLoss} min={0} onChange={(maxDailyLoss) => set({ maxDailyLoss })} suffix="USD" />
        </Row>
        <Row label={t("developer.builder.oneAtATime")}>
          <Toggle checked={spec.oneAtATime} onChange={(oneAtATime) => set({ oneAtATime })} label={t("developer.builder.oneAtATime")} />
        </Row>
      </div>
    </div>
  );
}

export function SymbolPicker({ spec, onChange, meta }: { spec: StrategySpec; onChange: (s: StrategySpec) => void; meta: Meta }) {
  const t = useT();
  const groups = ["forex", "metals", "indices", "energies", "crypto", "stocks"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Menu
        align="start"
        width={240}
        trigger={
          <button type="button" aria-label={t("developer.builder.symbol")} className={cn(chipBase, TONE.neutral.chip, "h-9 gap-2 px-3")}>
            <SymbolAvatar symbol={spec.symbol} size={18} />
            <span className="font-mono">{spec.symbol}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        }
        items={groups.flatMap((g, gi) => [
          ...(gi > 0 ? (["sep"] as const) : []),
          ...meta.symbols.filter((s) => s.assetClass === g).map((s) => ({ label: s.symbol, hint: s.symbol === spec.symbol ? <Check className="size-3.5 text-ember" /> : t.dyn(`developer.assetClass.${g}`, g), onSelect: () => onChange({ ...spec, symbol: s.symbol }) })),
        ])}
      />
      <Segmented size="sm" value={spec.timeframe} onChange={(timeframe) => onChange({ ...spec, timeframe })} options={meta.timeframes.filter((tf) => tf !== "MN").map((tf) => ({ value: tf, label: tf }))} />
    </div>
  );
}

export function VisualEditor({ spec, onChange, meta }: { spec: StrategySpec; onChange: (s: StrategySpec) => void; meta: Meta }) {
  const t = useT();
  const set = (p: Partial<StrategySpec>) => onChange({ ...spec, ...p });
  return (
    <div className="space-y-3">
      <RuleSetEditor title={t("developer.builder.buyWhen")} sub={t("developer.builder.entryLong")} tone="up" rs={spec.long} onChange={(long) => set({ long })} meta={meta} baseTf={spec.timeframe} />
      <RuleSetEditor title={t("developer.builder.sellWhen")} sub={t("developer.builder.entryShort")} tone="down" rs={spec.short} onChange={(short) => set({ short })} meta={meta} baseTf={spec.timeframe} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <RuleSetEditor title={t("developer.builder.exitBuys")} sub={t("developer.builder.besidesSlTp")} tone="gold" rs={spec.exitLong} onChange={(exitLong) => set({ exitLong })} meta={meta} baseTf={spec.timeframe} />
        <RuleSetEditor title={t("developer.builder.exitSells")} sub={t("developer.builder.besidesSlTp")} tone="gold" rs={spec.exitShort} onChange={(exitShort) => set({ exitShort })} meta={meta} baseTf={spec.timeframe} />
      </div>
    </div>
  );
}
