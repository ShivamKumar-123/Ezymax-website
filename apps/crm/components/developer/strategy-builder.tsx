"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Clock3, Plus, Repeat2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Menu, SymbolAvatar, cn } from "@/components/kit";
import { INSTRUMENTS } from "@kalks/mock";
import {
  COMPARATORS,
  INDICATORS,
  INDICATOR_MAP,
  SESSIONS,
  TIMEFRAMES,
  type Comparator,
  type Condition,
  type Operand,
  type StrategyRules,
} from "@kalks/mock/algo";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

type Tone = "ember" | "gold" | "up" | "down" | "info" | "neutral";

const TONE: Record<Tone, { chip: string; bar: string; label: string; line: string }> = {
  ember: { chip: "border-ember/30 bg-ember-soft text-ember hover:border-ember/60", bar: "bg-ember", label: "text-ember", line: "from-ember/60" },
  gold: { chip: "border-gold/30 bg-gold-soft text-gold hover:border-gold/60", bar: "bg-gold", label: "text-gold", line: "from-gold/60" },
  up: { chip: "border-up/30 bg-up-soft text-up hover:border-up/60", bar: "bg-up", label: "text-up", line: "from-up/60" },
  down: { chip: "border-down/30 bg-down-soft text-down hover:border-down/60", bar: "bg-down", label: "text-down", line: "from-down/60" },
  info: { chip: "border-info/30 bg-info-soft text-info hover:border-info/60", bar: "bg-info", label: "text-info", line: "from-info/60" },
  neutral: { chip: "border-line bg-surface-3 text-fg hover:border-[var(--k-border-top)]", bar: "bg-fg-3", label: "text-fg-2", line: "from-fg-3/60" },
};

const chipBase = "inline-flex h-8 items-center gap-1 rounded-[10px] border px-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ember/40";

function NumInput({ value, onChange, step = 1, className, suffix }: { value: number; onChange: (v: number) => void; step?: number; className?: string; suffix?: string }) {
  const [txt, setTxt] = React.useState(String(value));
  React.useEffect(() => setTxt(String(value)), [value]);
  return (
    <span className={cn("inline-flex items-center", className)}>
      <input
        value={txt}
        inputMode="decimal"
        aria-label="Value"
        onChange={(e) => {
          setTxt(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const n = +(value + (e.key === "ArrowUp" ? step : -step)).toFixed(4);
            onChange(n);
          }
        }}
        onBlur={() => setTxt(String(value))}
        style={{ width: `${Math.max(2, txt.length) + 1}ch` }}
        className="k-num h-6 rounded-md bg-black/25 light:bg-surface-2 px-1 text-center text-[12.5px] text-fg outline-none focus:ring-1 focus:ring-current"
      />
      {suffix && <span className="ml-1 opacity-80">{suffix}</span>}
    </span>
  );
}

function PickChip<T extends string>({
  value,
  options,
  onChange,
  tone = "neutral",
  width = 200,
  children,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  tone?: Tone;
  width?: number;
  children?: React.ReactNode;
}) {
  const cur = options.find((o) => o.value === value);
  return (
    <Menu
      align="start"
      width={width}
      trigger={
        <button type="button" className={cn(chipBase, TONE[tone].chip)}>
          {children ?? cur?.label}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      }
      items={options.map((o) => ({ label: o.label, hint: o.value === value ? <Check className="size-3.5 text-ember" /> : o.hint, icon: o.icon, onSelect: () => onChange(o.value) }))}
    />
  );
}

function OperandChip({ o, onChange, tone }: { o: Operand; onChange: (o: Operand) => void; tone: Tone }) {
  const def = INDICATOR_MAP[o.kind];
  return (
    <span className={cn(chipBase, TONE[tone].chip, "gap-0 pr-1.5")}>
      <Menu
        align="start"
        width={250}
        trigger={
          <button type="button" className="inline-flex h-full items-center gap-1 outline-none">
            {o.kind === "value" ? <span className="text-[11px] uppercase tracking-wide opacity-70">val</span> : def.label}
            <ChevronDown className="size-3 opacity-60" />
          </button>
        }
        items={INDICATORS.map((d) => ({
          label: d.label,
          hint: d.kind === o.kind ? <Check className="size-3.5 text-ember" /> : d.group,
          onSelect: () => onChange({ kind: d.kind, period: d.period, value: d.kind === "value" ? (o.value ?? 50) : undefined }),
        }))}
      />
      {o.kind === "value" ? (
        <NumInput className="ml-1" value={o.value ?? 0} step={o.value !== undefined && Math.abs(o.value) < 1 ? 0.0001 : 1} onChange={(v) => onChange({ ...o, value: v })} />
      ) : def.period !== undefined ? (
        <span className="ml-0.5 inline-flex items-center">
          (<NumInput value={o.period ?? def.period} onChange={(v) => onChange({ ...o, period: Math.max(1, Math.round(v)) })} />)
        </span>
      ) : (
        <span className="w-1" />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

function Block({ tone, label, sub, children, onRemove }: { tone: Tone; label: string; sub: string; children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="k-row group relative overflow-hidden py-3 pl-5 pr-3 transition-colors hover:border-[var(--k-border-top)]">
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", TONE[tone].bar)} />
      <span className={cn("pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r to-transparent opacity-[0.07]", TONE[tone].line)} />
      <div className="relative flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
        <div className="flex shrink-0 items-baseline gap-2 pt-1 max-sm:order-first max-sm:flex-1 sm:block sm:w-[62px]">
          <div className={cn("text-[11.5px] font-semibold uppercase tracking-[0.08em]", TONE[tone].label)}>{label}</div>
          <div className="text-[10.5px] text-fg-3 sm:mt-0.5">{sub}</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[13px] text-fg-3 max-sm:order-last max-sm:basis-full">{children}</div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="grid size-7 shrink-0 place-items-center rounded-full text-fg-3 opacity-60 transition hover:bg-down-soft hover:text-down group-hover:opacity-100" aria-label="Remove condition">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Connector({ from, to, label, onClick }: { from: Tone; to: Tone; label?: string; onClick?: () => void }) {
  return (
    <div className="relative h-7">
      <span className={cn("absolute left-[31px] top-0 h-full w-px bg-gradient-to-b", TONE[from].line, to === "gold" ? "to-gold/60" : to === "up" ? "to-up/60" : to === "down" ? "to-down/60" : to === "info" ? "to-info/60" : "to-ember/60")} />
      <span className="absolute left-[28px] top-1/2 size-[7px] -translate-y-1/2 rounded-full border border-line bg-surface-3" />
      {label &&
        (onClick ? (
          <button type="button" onClick={onClick} className="absolute left-[44px] top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-fg-2 transition hover:border-gold/50 hover:text-gold">
            {label}
            <Repeat2 className="size-3" />
          </button>
        ) : (
          <span className="absolute left-[44px] top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold tracking-wider text-fg-3">{label}</span>
        ))}
    </div>
  );
}

const CMP_OPTS = COMPARATORS.map((c) => ({ value: c.value, label: c.label }));

const PRESETS: { label: string; make: () => Omit<Condition, "id"> }[] = [
  { label: "RSI(14) < 70", make: () => ({ left: { kind: "rsi", period: 14 }, op: "<", right: { kind: "value", value: 70 } }) },
  { label: "Close > SMA(200)", make: () => ({ left: { kind: "price" }, op: ">", right: { kind: "sma", period: 200 } }) },
  { label: "EMA(9) > EMA(21)", make: () => ({ left: { kind: "ema", period: 9 }, op: ">", right: { kind: "ema", period: 21 } }) },
  { label: "MACD hist > 0", make: () => ({ left: { kind: "macd" }, op: ">", right: { kind: "value", value: 0 } }) },
  { label: "ATR(14) > value", make: () => ({ left: { kind: "atr", period: 14 }, op: ">", right: { kind: "value", value: 1.2 } }) },
  { label: "Close < BB lower(20)", make: () => ({ left: { kind: "price" }, op: "<", right: { kind: "bb_lower", period: 20 } }) },
];

const SYMBOLS = INSTRUMENTS.filter((i) => ["forex", "metals", "indices", "crypto", "energies"].includes(i.assetClass)).slice(0, 18);

export function VisualBuilder({ rules, onChange }: { rules: StrategyRules; onChange: (r: StrategyRules) => void }) {
  const set = (patch: Partial<StrategyRules>) => onChange({ ...rules, ...patch });
  const setCond = (id: string, patch: Partial<Condition>) => set({ conditions: rules.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const actionTone: Tone = rules.side === "buy" ? "up" : "down";
  const [trigger, ...filters] = rules.conditions;
  const counter = React.useRef(100);

  const addCondition = (p: (typeof PRESETS)[number]) => {
    if (rules.conditions.length >= 6) return toast.error("Up to 6 conditions per entry block");
    counter.current += 1;
    set({ conditions: [...rules.conditions, { id: `c${counter.current}`, ...p.make() }] });
    toast.success("Condition added", { description: p.label });
  };

  const condChips = (c: Condition, tone: Tone) => (
    <>
      <OperandChip o={c.left} tone={tone} onChange={(o) => setCond(c.id, { left: o })} />
      <PickChip value={c.op} options={CMP_OPTS} onChange={(v: Comparator) => setCond(c.id, { op: v })} width={180} />
      <OperandChip o={c.right} tone={tone} onChange={(o) => setCond(c.id, { right: o })} />
    </>
  );

  const joinLabel = rules.join.toUpperCase();
  const toggleJoin = () => set({ join: rules.join === "and" ? "or" : "and" });

  return (
    <div className="relative">
      {trigger && (
        <Block tone="ember" label="When" sub="Trigger">
          {condChips(trigger, "ember")}
          <span className="px-0.5">on</span>
          <PickChip
            value={rules.symbol}
            width={240}
            onChange={(v) => set({ symbol: v })}
            options={SYMBOLS.map((i) => ({ value: i.symbol, label: i.symbol, icon: <SymbolAvatar symbol={i.symbol} size={18} />, hint: i.assetClass }))}
          >
            <SymbolAvatar symbol={rules.symbol} size={16} />
            <span className="ml-0.5">{rules.symbol}</span>
          </PickChip>
          <PickChip value={rules.timeframe} width={150} onChange={(v) => set({ timeframe: v })} options={TIMEFRAMES.map((t) => ({ value: t, label: t }))} />
          <span className="px-0.5">during</span>
          <PickChip value={rules.session} width={230} onChange={(v) => set({ session: v })} options={SESSIONS.map((s) => ({ value: s.value, label: s.label, hint: s.hours }))}>
            <Clock3 className="size-3.5 opacity-70" />
            {SESSIONS.find((s) => s.value === rules.session)!.label}
          </PickChip>
        </Block>
      )}

      <AnimatePresence initial={false}>
        {filters.map((c, i) => (
          <motion.div
            key={c.id}
            layout
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <Connector from={i === 0 ? "ember" : "gold"} to="gold" label={joinLabel} onClick={toggleJoin} />
            <Block tone="gold" label={joinLabel} sub="Condition" onRemove={() => set({ conditions: rules.conditions.filter((x) => x.id !== c.id) })}>
              {condChips(c, "gold")}
            </Block>
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.div layout className="relative">
        <div className="relative h-11">
          <span className="absolute left-[31px] top-0 h-full w-px bg-gradient-to-b from-gold/60 to-transparent" />
          <Menu
            align="start"
            width={230}
            items={PRESETS.map((p) => ({ label: p.label, icon: <Plus />, onSelect: () => addCondition(p) }))}
            trigger={
              <button type="button" className="absolute left-[44px] top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-full border border-dashed border-gold/40 px-3 text-[12.5px] font-medium text-gold transition hover:border-gold hover:bg-gold-soft">
                <Plus className="size-3.5" /> Add condition
              </button>
            }
          />
        </div>

        <Connector from="gold" to={actionTone} label="THEN" />
        <Block tone={actionTone} label="Then" sub="Action">
          <PickChip
            value={rules.side}
            tone={actionTone}
            width={160}
            onChange={(v) => set({ side: v })}
            options={[
              { value: "buy", label: "Buy" },
              { value: "sell", label: "Sell" },
            ]}
          />
          <span className={cn(chipBase, TONE.neutral.chip, "pr-1.5")}>
            <NumInput value={rules.sizing.value} step={rules.sizing.mode === "lots" ? 0.1 : 0.25} onChange={(v) => set({ sizing: { ...rules.sizing, value: Math.max(0.01, v) } })} />
          </span>
          <PickChip
            value={rules.sizing.mode}
            width={200}
            onChange={(v) => set({ sizing: { mode: v, value: v === "lots" ? 0.5 : 1 } })}
            options={[
              { value: "lots", label: "lots", hint: "Fixed volume" },
              { value: "risk", label: "% equity risk", hint: "Auto-sized" },
            ]}
          />
          <span className="px-0.5">at market</span>
        </Block>

        <Connector from={actionTone} to="info" />
        <Block tone="info" label="Risk" sub="Exits">
          <span className="font-medium text-fg-2">SL</span>
          <span className={cn(chipBase, TONE.info.chip, "pr-1.5")}>
            <NumInput value={rules.sl.value} step={rules.sl.mode === "atr" ? 0.25 : 5} onChange={(v) => set({ sl: { ...rules.sl, value: Math.max(0.1, v) } })} />
          </span>
          <PickChip
            value={rules.sl.mode}
            width={170}
            onChange={(v) => set({ sl: { mode: v, value: v === "atr" ? 1.5 : 25 } })}
            options={[
              { value: "atr", label: "× ATR(14)" },
              { value: "pips", label: "pips" },
            ]}
          />
          <span className="ml-1 font-medium text-fg-2">TP</span>
          <span className={cn(chipBase, TONE.info.chip, "pr-1.5")}>
            <NumInput value={rules.tp.value} step={rules.tp.mode === "pips" ? 5 : 0.25} onChange={(v) => set({ tp: { ...rules.tp, value: Math.max(0.1, v) } })} />
          </span>
          <PickChip
            value={rules.tp.mode}
            width={170}
            onChange={(v) => set({ tp: { mode: v, value: v === "atr" ? 3 : v === "rr" ? 2 : 40 } })}
            options={[
              { value: "atr", label: "× ATR(14)" },
              { value: "rr", label: "R multiple" },
              { value: "pips", label: "pips" },
            ]}
          />
          <button
            type="button"
            onClick={() => set({ trailing: !rules.trailing })}
            className={cn(chipBase, rules.trailing ? TONE.info.chip : "border-dashed border-line text-fg-3 hover:text-fg-2", "ml-1")}
          >
            <span className={cn("size-1.5 rounded-full", rules.trailing ? "bg-info" : "bg-fg-3")} />
            Trailing {rules.trailing ? "on" : "off"}
          </button>
        </Block>
      </motion.div>
    </div>
  );
}

/** Plain-English one-liner of the current rules. */
export function RulesSentence({ rules }: { rules: StrategyRules }) {
  const cond = rules.conditions
    .map((c) => {
      const cmp = COMPARATORS.find((x) => x.value === c.op)!.label;
      const l = c.left.kind === "value" ? c.left.value : `${INDICATOR_MAP[c.left.kind].label}${INDICATOR_MAP[c.left.kind].period !== undefined ? `(${c.left.period})` : ""}`;
      const r = c.right.kind === "value" ? c.right.value : `${INDICATOR_MAP[c.right.kind].label}${INDICATOR_MAP[c.right.kind].period !== undefined ? `(${c.right.period})` : ""}`;
      return `${l} ${cmp} ${r}`;
    })
    .join(` ${rules.join} `);
  const size = rules.sizing.mode === "lots" ? `${rules.sizing.value} lots` : `${rules.sizing.value}% risk`;
  return (
    <p className="text-[13px] leading-relaxed text-fg-2">
      <span className={cn("font-medium", rules.side === "buy" ? "text-up" : "text-down")}>{rules.side === "buy" ? "Buy" : "Sell"}</span> {size} of{" "}
      <span className="font-medium text-fg">{rules.symbol}</span> on {rules.timeframe} when <span className="text-fg">{cond}</span>
      {rules.session !== "any" && <> during the {SESSIONS.find((s) => s.value === rules.session)!.label} session</>} · SL{" "}
      {rules.sl.mode === "atr" ? `${rules.sl.value}×ATR` : `${rules.sl.value} pips`} · TP {rules.tp.mode === "atr" ? `${rules.tp.value}×ATR` : rules.tp.mode === "rr" ? `${rules.tp.value}R` : `${rules.tp.value} pips`}
      {rules.trailing && " · trailing"}
    </p>
  );
}
