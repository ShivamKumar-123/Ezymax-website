"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { INSTRUMENTS } from "@kalks/mock";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import type { T as Tr } from "@kalks/i18n";
import { TIMEFRAMES, type Timeframe } from "@/lib/trading";
import { Check, TInput, TSelect } from "@/components/ui/primitives";
import {
  DISTANCE_MODES,
  INDICATOR_NAMES,
  OPERATORS,
  PRICE_FIELDS,
  CANDLE_PATTERNS,
  TRAIL_MODES,
  ind,
  operand,
  price,
  val,
  type Condition,
  type Distance,
  type Operand,
  type RuleSet,
  type StrategySpec,
} from "@/lib/ai-trader/schema";
import { OP_LABEL, describeDistance, describeOperand, describeRuleSet, describeSchedule, describeSizing, describeTrailing, trimNum } from "@/lib/ai-trader/describe";

/* ------------------------------------------------------------------ */
/* Small inputs                                                        */
/* ------------------------------------------------------------------ */

/** Numeric input that keeps its own text while typing and commits valid numbers. */
export function NumIn({ value, onChange, disabled, className, ariaLabel, step }: { value: number; onChange: (v: number) => void; disabled?: boolean; className?: string; ariaLabel: string; step?: number }) {
  const [txt, setTxt] = React.useState(trimNum(value));
  const last = React.useRef(value);
  if (last.current !== value) {
    last.current = value;
    if (+txt !== value) setTxt(trimNum(value));
  }
  return (
    <TInput
      aria-label={ariaLabel}
      inputMode="decimal"
      disabled={disabled}
      value={txt}
      step={step}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.\-]/g, "");
        setTxt(t);
        if (t !== "" && Number.isFinite(+t)) onChange(+t);
      }}
      onBlur={() => setTxt(trimNum(value))}
      className={cn("k-num h-6 px-1.5 text-end font-mono text-[11.5px] disabled:opacity-60", className)}
    />
  );
}

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-2 py-[3px]">
      <span className="text-[11px] text-fg-3" title={hint}>
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="border-b border-line/70 px-3 py-2">
      <div className="mb-1 flex items-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-fg-3">{title}</span>
        <span className="ms-auto">{right}</span>
      </div>
      {children}
    </div>
  );
}

const sel = "h-6 text-[11.5px]";

/* ------------------------------------------------------------------ */
/* Rule editor                                                         */
/* ------------------------------------------------------------------ */

function OperandEdit({ o, onChange, disabled }: { o: Operand; onChange: (o: Operand) => void; disabled: boolean }) {
  const t = useT();
  if (disabled) return <span className="font-mono text-[11.5px] text-fg">{describeOperand(o)}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1">
      <TSelect
        ariaLabel="Operand type"
        value={o.kind === "indicator" ? o.indicator : o.kind === "candle" ? "candle" : o.kind === "value" ? "value" : `price:${o.field}`}
        onChange={(v) => {
          if (v === "value") onChange(val(o.kind === "value" ? o.value : 0));
          else if (v === "candle") onChange(operand({ kind: "candle", pattern: "bullish" }));
          else if (v.startsWith("price:")) onChange(price(v.slice(6) as Operand["field"]));
          else onChange(ind(v as Operand["indicator"], 0));
        }}
        options={[
          ...PRICE_FIELDS.map((f) => ({ value: `price:${f}`, label: f === "close" ? t("aiTrader.card.operand.close") : f.toUpperCase() })),
          ...INDICATOR_NAMES.filter((n) => n !== "none").map((n) => ({ value: n, label: describeOperand(ind(n, 0)).replace(/\(.*\)/, "") })),
          { value: "value", label: t("aiTrader.card.operand.value") },
          { value: "candle", label: t("aiTrader.card.operand.candle") },
        ]}
        className={cn(sel, "w-[96px]")}
      />
      {o.kind === "indicator" && (
        <>
          <NumIn ariaLabel="Period" value={o.period} onChange={(v) => onChange({ ...o, period: Math.max(1, Math.round(v)) })} className="w-[42px]" />
          {o.indicator.startsWith("macd") && (
            <>
              <NumIn ariaLabel="Slow period" value={o.period2} onChange={(v) => onChange({ ...o, period2: Math.max(1, Math.round(v)) })} className="w-[38px]" />
              <NumIn ariaLabel="Signal period" value={o.period3} onChange={(v) => onChange({ ...o, period3: Math.max(1, Math.round(v)) })} className="w-[34px]" />
            </>
          )}
          {o.indicator.startsWith("bb_") && <NumIn ariaLabel="Deviations" value={o.mult} onChange={(v) => onChange({ ...o, mult: v })} className="w-[36px]" />}
        </>
      )}
      {o.kind === "value" && <NumIn ariaLabel="Value" value={o.value} onChange={(v) => onChange({ ...o, value: v })} className="w-[72px]" />}
      {o.kind === "candle" && (
        <TSelect ariaLabel="Pattern" value={o.pattern} onChange={(v) => onChange({ ...o, pattern: v })} options={CANDLE_PATTERNS.filter((p) => p !== "none").map((p) => ({ value: p, label: p.replace(/_/g, " ") }))} className={cn(sel, "w-[120px]")} />
      )}
    </span>
  );
}

function RuleEdit({ title, rs, onChange, disabled, tone }: { title: string; rs: RuleSet; onChange: (r: RuleSet) => void; disabled: boolean; tone: "up" | "down" | "fg" }) {
  const t = useT();
  const setCond = (gi: number, ci: number, c: Condition | null) =>
    onChange({
      ...rs,
      groups: rs.groups
        .map((g, i) => (i !== gi ? g : { ...g, conditions: c ? g.conditions.map((x, j) => (j === ci ? c : x)) : g.conditions.filter((_, j) => j !== ci) }))
        .filter((g) => g.conditions.length),
    });
  const add = () => {
    const c: Condition = { left: ind("rsi", 14), op: "crosses_above", right: val(30), timeframe: "same" };
    onChange(rs.groups.length ? { ...rs, groups: rs.groups.map((g, i) => (i === 0 ? { ...g, conditions: [...g.conditions, c] } : g)) } : { logic: "all", groups: [{ logic: "all", conditions: [c] }] });
  };
  return (
    <Section
      title={title}
      right={
        !disabled && (
          <button onClick={add} className="flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg">
            <Plus className="size-3" /> {t("aiTrader.card.condition")}
          </button>
        )
      }
    >
      {!rs.groups.length && <div className="text-[11.5px] text-fg-3">{t("aiTrader.card.none")}</div>}
      {rs.groups.map((g, gi) => (
        <div key={gi} className={cn(gi > 0 && "mt-1 border-t border-dashed border-line pt-1")}>
          {gi > 0 && <div className="mb-0.5 text-[10px] font-semibold uppercase text-gold">{t(rs.logic === "any" ? "aiTrader.card.or" : "aiTrader.card.and")}</div>}
          {g.conditions.map((c, ci) => (
            <div key={ci} className="flex min-w-0 flex-wrap items-center gap-1 py-[2px]">
              {ci > 0 && <span className="w-7 text-[10px] font-semibold uppercase text-fg-3">{t(g.logic === "all" ? "aiTrader.card.and" : "aiTrader.card.or")}</span>}
              <span className={cn("me-0.5 h-3 w-[2px] rounded-full", tone === "up" ? "bg-up" : tone === "down" ? "bg-down" : "bg-fg-3")} />
              <OperandEdit o={c.left} disabled={disabled} onChange={(o) => setCond(gi, ci, { ...c, left: o })} />
              {disabled ? (
                <span className="text-[11.5px] text-gold">{OP_LABEL[c.op]}</span>
              ) : (
                <TSelect ariaLabel="Operator" value={c.op} onChange={(v) => setCond(gi, ci, { ...c, op: v })} options={OPERATORS.map((o) => ({ value: o, label: OP_LABEL[o] }))} className={cn(sel, "w-[104px]")} />
              )}
              <OperandEdit o={c.right} disabled={disabled} onChange={(o) => setCond(gi, ci, { ...c, right: o })} />
              {disabled ? (
                c.timeframe !== "same" && <span className="rounded-[3px] bg-surface-3 px-1 font-mono text-[10px] text-fg-2">{c.timeframe}</span>
              ) : (
                <TSelect ariaLabel="Condition timeframe" value={c.timeframe} onChange={(v) => setCond(gi, ci, { ...c, timeframe: v })} options={[{ value: "same", label: t("aiTrader.card.sameTf") }, ...TIMEFRAMES.map((t) => ({ value: t, label: t }))]} className={cn(sel, "w-[78px]")} />
              )}
              {!disabled && (
                <button aria-label={t("aiTrader.card.removeCondition")} onClick={() => setCond(gi, ci, null)} className="ms-auto grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-down-soft hover:text-down">
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </Section>
  );
}

function DistanceEdit({ d, onChange, disabled, kind }: { d: Distance; onChange: (d: Distance) => void; disabled: boolean; kind: "sl" | "tp" }) {
  const t = useT();
  if (disabled) return <span className="font-mono text-[11.5px] text-fg">{describeDistance(d, kind)}</span>;
  return (
    <>
      <TSelect ariaLabel={`${kind} mode`} value={d.mode} onChange={(v) => onChange({ ...d, mode: v })} options={DISTANCE_MODES.filter((m) => kind === "tp" || m !== "rr").map((m) => ({ value: m, label: modeLabel(t, m) }))} className={cn(sel, "w-[112px]")} />
      {d.mode !== "none" && <NumIn ariaLabel={`${kind} value`} value={d.value} onChange={(v) => onChange({ ...d, value: Math.abs(v) })} className="w-[80px]" />}
      {d.mode === "atr" && (
        <>
          <span className="text-[11px] text-fg-3">ATR</span>
          <NumIn ariaLabel="ATR period" value={d.atrPeriod} onChange={(v) => onChange({ ...d, atrPeriod: Math.max(1, Math.round(v)) })} className="w-[40px]" />
        </>
      )}
    </>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function modeLabel(t: Tr, m: string) {
  return t.dyn(`aiTrader.card.mode.${m}`, m);
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function StrategyCard({ spec, onChange, editable }: { spec: StrategySpec; onChange: (s: StrategySpec) => void; editable: boolean }) {
  const t = useT();
  const set = (p: Partial<StrategySpec>) => onChange({ ...spec, ...p });
  const dis = !editable;
  const [sessTxt, setSessTxt] = React.useState(spec.sessions.map((s) => `${s.start}-${s.end}`).join(", "));
  React.useEffect(() => {
    setSessTxt(spec.sessions.map((s) => `${s.start}-${s.end}`).join(", "));
  }, [spec.sessions]);
  const buys = spec.long.groups.length > 0;
  const sells = spec.short.groups.length > 0;
  return (
    <div className="text-[12px]">
      <Section title={t("aiTrader.card.instrument")}>
        <Row label={t("aiTrader.card.name")}>{dis ? <span className="truncate text-fg">{spec.name}</span> : <TInput aria-label={t("aiTrader.card.nameAria")} value={spec.name} onChange={(e) => set({ name: e.target.value.slice(0, 48) })} className="h-6 text-[11.5px]" />}</Row>
        <Row label={t("aiTrader.card.symbolTf")}>
          {dis ? (
            <span className="font-mono text-fg">
              {spec.symbol} · {spec.timeframe}
            </span>
          ) : (
            <>
              <TSelect ariaLabel="Symbol" value={spec.symbol} onChange={(v) => set({ symbol: v })} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: i.symbol }))} className={cn(sel, "w-[110px]")} />
              <TSelect ariaLabel="Timeframe" value={spec.timeframe} onChange={(v: Timeframe) => set({ timeframe: v })} options={TIMEFRAMES.map((t) => ({ value: t, label: t }))} className={cn(sel, "w-[70px]")} />
            </>
          )}
        </Row>
        <Row label={t("aiTrader.card.direction")}>
          <span className={cn("font-medium", buys && sells ? "text-gold" : sells ? "text-down" : "text-up")}>{t(buys && sells ? "aiTrader.card.buyAndSell" : sells ? "aiTrader.card.sellOnly" : "aiTrader.card.buyOnly")}</span>
          <span className="text-[11px] text-fg-3">{t("aiTrader.card.evaluated", { tf: spec.timeframe })}</span>
        </Row>
      </Section>

      <RuleEdit title={t("aiTrader.card.buyWhen")} rs={spec.long} onChange={(long) => set({ long })} disabled={dis} tone="up" />
      <RuleEdit title={t("aiTrader.card.sellWhen")} rs={spec.short} onChange={(short) => set({ short })} disabled={dis} tone="down" />
      {(buys || !dis) && <RuleEdit title={t("aiTrader.card.closeBuysWhen")} rs={spec.exitLong} onChange={(exitLong) => set({ exitLong })} disabled={dis} tone="fg" />}
      {(sells || !dis) && <RuleEdit title={t("aiTrader.card.closeSellsWhen")} rs={spec.exitShort} onChange={(exitShort) => set({ exitShort })} disabled={dis} tone="fg" />}

      <Section title={t("aiTrader.card.sizeProtection")}>
        <Row label={t("aiTrader.card.volume")}>
          {dis ? (
            <span className="font-mono text-fg">
              {describeSizing(spec)} · {t("aiTrader.card.capLots", { lots: spec.maxLots.toFixed(2) })}
            </span>
          ) : (
            <>
              <TSelect ariaLabel="Sizing mode" value={spec.sizing.mode} onChange={(v) => set({ sizing: { ...spec.sizing, mode: v } })} options={[{ value: "lots", label: t("aiTrader.card.fixedLots") }, { value: "risk", label: t("aiTrader.card.riskPct") }]} className={cn(sel, "w-[112px]")} />
              {spec.sizing.mode === "lots" ? (
                <NumIn ariaLabel="Lots" value={spec.sizing.lots} onChange={(v) => set({ sizing: { ...spec.sizing, lots: Math.abs(v) } })} className="w-[64px]" />
              ) : (
                <NumIn ariaLabel="Risk percent" value={spec.sizing.riskPct} onChange={(v) => set({ sizing: { ...spec.sizing, riskPct: Math.abs(v) } })} className="w-[56px]" />
              )}
              <span className="text-[11px] text-fg-3">{t("aiTrader.card.cap")}</span>
              <NumIn ariaLabel="Max lots per order" value={spec.maxLots} onChange={(v) => set({ maxLots: Math.abs(v) })} className="w-[56px]" />
            </>
          )}
        </Row>
        <Row label={t("aiTrader.card.stopLoss")}>
          <DistanceEdit d={spec.sl} kind="sl" disabled={dis} onChange={(sl) => set({ sl })} />
        </Row>
        <Row label={t("aiTrader.card.takeProfit")}>
          <DistanceEdit d={spec.tp} kind="tp" disabled={dis} onChange={(tp) => set({ tp })} />
        </Row>
        <Row label={t("aiTrader.card.trailing")}>
          {dis ? (
            <span className="font-mono text-[11.5px] text-fg">{describeTrailing(spec.trailing)}</span>
          ) : (
            <>
              <TSelect ariaLabel="Trailing mode" value={spec.trailing.mode} onChange={(v) => set({ trailing: { ...spec.trailing, mode: v } })} options={TRAIL_MODES.map((m) => ({ value: m, label: modeLabel(t, m) }))} className={cn(sel, "w-[82px]")} />
              {spec.trailing.mode !== "none" && <NumIn ariaLabel="Trailing distance" value={spec.trailing.value} onChange={(v) => set({ trailing: { ...spec.trailing, value: Math.abs(v) } })} className="w-[70px]" />}
            </>
          )}
        </Row>
        {!dis && (
          <Row label={t("aiTrader.card.breakeven")} hint={t("aiTrader.card.breakevenHint")}>
            <span className="text-[11px] text-fg-3">{t("aiTrader.card.at")}</span>
            <NumIn ariaLabel="Breakeven trigger points" value={spec.trailing.breakevenTrigger} onChange={(v) => set({ trailing: { ...spec.trailing, breakevenTrigger: Math.abs(v) } })} className="w-[64px]" />
            <span className="text-[11px] text-fg-3">{t("aiTrader.card.ptsLock")}</span>
            <NumIn ariaLabel="Breakeven offset points" value={spec.trailing.breakevenOffset} onChange={(v) => set({ trailing: { ...spec.trailing, breakevenOffset: v } })} className="w-[52px]" />
            <span className="text-[11px] text-fg-3">{t("aiTrader.card.pts")}</span>
          </Row>
        )}
      </Section>

      <Section title={t("aiTrader.card.scheduleLimits")}>
        <Row label={t("aiTrader.card.window")}>
          {dis ? (
            <span className="text-fg">{describeSchedule(spec)}</span>
          ) : (
            <TInput
              aria-label="Trading windows"
              placeholder={t("aiTrader.card.windowPlaceholder")}
              value={sessTxt}
              onChange={(e) => setSessTxt(e.target.value)}
              onBlur={() => {
                const list = sessTxt
                  .split(/[,;]/)
                  .map((x) => x.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/))
                  .filter(Boolean)
                  .map((m) => ({ start: `${m![1]!.padStart(2, "0")}:${m![2]}`, end: `${m![3]!.padStart(2, "0")}:${m![4]}` }));
                set({ sessions: list });
              }}
              className="h-6 font-mono text-[11.5px]"
            />
          )}
        </Row>
        {!dis && (
          <Row label={t("aiTrader.card.days")}>
            {DAYS.map((d, i) => {
              const on = spec.days.length === 0 || spec.days.includes(i);
              return (
                <button
                  key={d}
                  onClick={() => {
                    const cur = spec.days.length ? spec.days : [0, 1, 2, 3, 4, 5, 6];
                    const next = on ? cur.filter((x) => x !== i) : [...cur, i].sort();
                    set({ days: next.length === 7 ? [] : next });
                  }}
                  className={cn("h-6 rounded-[5px] px-1.5 text-[10.5px]", on ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}
                >
                  {t(`aiTrader.day.${i}` as "aiTrader.day.0")}
                </button>
              );
            })}
          </Row>
        )}
        <Row label={t("aiTrader.card.limits")}>
          {dis ? (
            <span className="text-fg">
              {spec.maxTradesPerDay ? t("aiTrader.card.tradesPerDay", { count: spec.maxTradesPerDay }) : t("aiTrader.card.noTradeLimit")} · {spec.maxDailyLoss ? t("aiTrader.card.maxDailyLoss", { value: spec.maxDailyLoss }) : t("aiTrader.card.noDailyLoss")} · {t(spec.oneAtATime ? "aiTrader.card.onePosition" : "aiTrader.card.multiplePositions")}
            </span>
          ) : (
            <>
              <NumIn ariaLabel="Max trades per day" value={spec.maxTradesPerDay} onChange={(v) => set({ maxTradesPerDay: Math.max(0, Math.round(v)) })} className="w-[44px]" />
              <span className="text-[11px] text-fg-3">{t("aiTrader.card.tradesDayMaxLoss")}</span>
              <NumIn ariaLabel="Max daily loss" value={spec.maxDailyLoss} onChange={(v) => set({ maxDailyLoss: Math.abs(v) })} className="w-[64px]" />
            </>
          )}
        </Row>
        {!dis && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <Check checked={spec.oneAtATime} onChange={(v) => set({ oneAtATime: v })} label={t("aiTrader.card.oneAtATime")} className="text-[11.5px]" />
            <Check checked={spec.closeOutsideSession} onChange={(v) => set({ closeOutsideSession: v })} label={t("aiTrader.card.closeOutside")} className="text-[11.5px]" />
            <Check checked={spec.exitIntrabar} onChange={(v) => set({ exitIntrabar: v })} label={t("aiTrader.card.exitIntrabar")} className="text-[11.5px]" />
          </div>
        )}
        {dis && (spec.closeOutsideSession || spec.exitIntrabar) && (
          <div className="pt-1 text-[11px] text-fg-3">
            {[spec.closeOutsideSession && t("aiTrader.card.closesOutside"), spec.exitIntrabar && t("aiTrader.card.exitsIntrabar")].filter(Boolean).join(" · ")}
          </div>
        )}
      </Section>
    </div>
  );
}

/** One-paragraph summary used in the activation confirmation. */
export function SpecSummary({ spec }: { spec: StrategySpec }) {
  const t = useT();
  const rows: [string, string][] = [
    [t("aiTrader.sum.instrument"), t("aiTrader.sum.instrumentValue", { symbol: spec.symbol, tf: spec.timeframe })],
    [t("aiTrader.card.buyWhen"), describeRuleSet(spec.long)],
    [t("aiTrader.card.sellWhen"), describeRuleSet(spec.short)],
    [t("aiTrader.sum.closeBuys"), describeRuleSet(spec.exitLong)],
    [t("aiTrader.sum.closeSells"), describeRuleSet(spec.exitShort)],
    [t("aiTrader.card.volume"), t("aiTrader.sum.volumeValue", { sizing: describeSizing(spec), lots: spec.maxLots.toFixed(2) })],
    [t("aiTrader.card.stopLoss"), describeDistance(spec.sl, "sl")],
    [t("aiTrader.card.takeProfit"), describeDistance(spec.tp, "tp")],
    [t("aiTrader.card.trailing"), describeTrailing(spec.trailing)],
    [t("aiTrader.card.window"), describeSchedule(spec)],
    [t("aiTrader.card.limits"), `${spec.maxTradesPerDay ? t("aiTrader.card.tradesPerDay", { count: spec.maxTradesPerDay }) : t("aiTrader.card.noTradeLimit")} · ${spec.maxDailyLoss ? t("aiTrader.sum.stopAfter", { value: spec.maxDailyLoss }) : t("aiTrader.card.noDailyLoss")} · ${t(spec.oneAtATime ? "aiTrader.card.onePosition" : "aiTrader.card.multiplePositions")}`],
  ];
  return (
    <div className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-[12px]">
      {rows
        .filter(([, v]) => v !== "—")
        .map(([k, v]) => (
          <React.Fragment key={k}>
            <span className="text-fg-3">{k}</span>
            <span className="font-mono text-[11.5px] text-fg">{v}</span>
          </React.Fragment>
        ))}
    </div>
  );
}
