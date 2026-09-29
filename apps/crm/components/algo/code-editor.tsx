"use client";

// Code editor for the Kalks strategy language: a textarea over a highlighted layer, a gutter with the
// compiler's error markers, and the reference. Validation runs on the server (POST /api/algo/validate).

import * as React from "react";
import { AlertTriangle, BookOpen, CircleCheck, Loader2 } from "lucide-react";
import { cn } from "@kalks/ui";
import { Trans, useT, useFormat } from "@kalks/i18n/react";
import type { BuildError } from "./api";

const KEYWORDS = new Set(["and", "or", "not", "if", "else", "True", "False", "true", "false"]);
const SETTINGS = new Set(["name", "symbol", "timeframe", "lots", "risk", "max_lots", "stop_loss", "take_profit", "trailing", "breakeven", "session", "days", "close_outside_session", "one_at_a_time", "max_trades_per_day", "max_daily_loss"]);
const SIGNALS = new Set(["buy", "sell", "exit_buy", "exit_sell", "long", "short", "exit_long", "exit_short"]);
const FIELDS = new Set(["open", "high", "low", "close", "volume", "hl2", "hlc3", "ohlc4", "hour", "minute", "weekday"]);
const FUNCS = new Set([
  "sma", "ema", "wma", "rma", "rsi", "stddev", "momentum", "roc", "change", "cci", "highest", "lowest", "atr", "willr", "adx", "plus_di", "minus_di", "stoch_k", "stoch_d",
  "macd", "macd_signal", "macd_hist", "bb_upper", "bb_middle", "bb_lower", "crosses_above", "crosses_below", "crosses", "abs", "min", "max", "sqrt", "round", "nz", "htf",
  "bullish", "bearish", "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "inside_bar",
]);

type Tok = { t: string; c: string };

function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [all, comment, str, num, ident, ws] = m;
    if (comment) out.push({ t: all, c: "text-fg-3 italic" });
    else if (str) out.push({ t: all, c: "text-up" });
    else if (num) out.push({ t: all, c: "text-gold" });
    else if (ident) {
      const next = line.slice(re.lastIndex).trimStart()[0];
      if (KEYWORDS.has(ident)) out.push({ t: all, c: "text-info font-medium" });
      else if (SIGNALS.has(ident)) out.push({ t: all, c: "text-ember font-semibold" });
      else if (SETTINGS.has(ident) && next === "(") out.push({ t: all, c: "text-[#c084fc]" });
      else if (FUNCS.has(ident) && next === "(") out.push({ t: all, c: "text-[#38bdf8]" });
      else if (FIELDS.has(ident)) out.push({ t: all, c: "text-[#f472b6]" });
      else out.push({ t: all, c: "text-fg" });
    } else if (ws) out.push({ t: all, c: "" });
    else out.push({ t: all, c: "text-fg-2" });
  }
  return out;
}

export function CodeEditor({ value, onChange, errors, warnings, validating, readOnly, height = 460 }: { value: string; onChange: (v: string) => void; errors: BuildError[]; warnings: string[]; validating: boolean; readOnly?: boolean; height?: number }) {
  const t = useT();
  const ta = React.useRef<HTMLTextAreaElement>(null);
  const hl = React.useRef<HTMLDivElement>(null);
  const gutter = React.useRef<HTMLDivElement>(null);
  const lines = value.split("\n");
  const errLines = new Map<number, string>();
  for (const e of errors) if (e.line) errLines.set(e.line, errLines.has(e.line) ? `${errLines.get(e.line)}; ${e.message}` : e.message);

  const sync = () => {
    if (!ta.current) return;
    if (hl.current) {
      hl.current.scrollTop = ta.current.scrollTop;
      hl.current.scrollLeft = ta.current.scrollLeft;
    }
    if (gutter.current) gutter.current.scrollTop = ta.current.scrollTop;
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: en } = el;
      const next = value.slice(0, s) + "    " + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
    }
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-[#0b0b0d]">
      <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2 text-[11.5px]">
        <span className="font-mono text-fg-3">strategy.kst</span>
        <span className="text-fg-3">· {t("developer.code.language")}</span>
        <span className="ms-auto inline-flex items-center gap-1.5">
          {validating ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-fg-3" /> <span className="text-fg-3">{t("developer.code.checking")}</span>
            </>
          ) : errors.length ? (
            <>
              <AlertTriangle className="size-3.5 text-down" /> <span className="text-down">{t("developer.code.errors", { count: errors.length })}</span>
            </>
          ) : (
            <>
              <CircleCheck className="size-3.5 text-up" /> <span className="text-up">{t("developer.code.compiles")}</span>
            </>
          )}
        </span>
      </div>
      <div dir="ltr" className="relative flex font-mono text-[12.5px] leading-[20px]" style={{ height }}>
        <div ref={gutter} aria-hidden className="w-11 shrink-0 overflow-hidden border-r border-line/60 bg-black/20 py-3 text-right text-fg-3">
          {lines.map((_, i) => (
            <div key={i} title={errLines.get(i + 1)} className={cn("pr-2", errLines.has(i + 1) && "bg-down-soft text-down")}>
              {i + 1}
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div ref={hl} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 py-3">
            {lines.map((l, i) => (
              <div key={i} className={cn(errLines.has(i + 1) && "underline decoration-down decoration-wavy underline-offset-4")}>
                {l ? tokenize(l).map((tk, j) => <span key={j} className={tk.c}>{tk.t}</span>) : "​"}
              </div>
            ))}
          </div>
          <textarea
            ref={ta}
            value={value}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={t("developer.code.aria")}
            onChange={(e) => onChange(e.target.value)}
            onScroll={sync}
            onKeyDown={onKey}
            className="absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-transparent caret-ember outline-none selection:bg-ember/30"
          />
        </div>
      </div>
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="max-h-40 space-y-1 overflow-y-auto border-t border-line/70 px-3 py-2 text-[12px]">
          {errors.map((e, i) => (
            <button
              key={`e${i}`}
              type="button"
              className="flex w-full items-start gap-2 text-start text-down hover:underline"
              onClick={() => {
                if (!e.line || !ta.current) return;
                const idx = lines.slice(0, e.line - 1).join("\n").length + (e.line > 1 ? 1 : 0) + Math.max(0, (e.col ?? 1) - 1);
                ta.current.focus();
                ta.current.setSelectionRange(idx, idx);
              }}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {e.line ? <span className="font-mono">{t("developer.code.line", { line: e.line, col: e.col ?? 1 })} · </span> : null}
                {e.message}
              </span>
            </button>
          ))}
          {warnings.map((w, i) => (
            <div key={`w${i}`} className="flex items-start gap-2 text-warn">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DslReference({ functions, settings, limits }: { functions: { syntax: string; text: string }[]; settings: { syntax: string; text: string }[]; limits: Record<string, number> }) {
  const t = useT();
  const f = useFormat();
  return (
    <details className="group rounded-[14px] border border-line bg-surface-2/40 px-4 py-3 text-[12.5px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-fg-2">
        <BookOpen className="size-4" /> {t("developer.code.reference")}
        <span className="ms-auto text-[11px] text-fg-3 group-open:hidden">{t("developer.code.show")}</span>
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="k-label mb-1.5">{t("developer.code.settings")}</div>
          {settings.map((s) => (
            <div key={s.syntax} className="py-1">
              <code className="font-mono text-[11.5px] text-[#c084fc]">{s.syntax}</code>
              <div className="text-[11.5px] text-fg-3">{s.text}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="k-label mb-1.5">{t("developer.code.functions")}</div>
          {functions.map((s) => (
            <div key={s.syntax} className="py-1">
              <code className="font-mono text-[11.5px] text-[#38bdf8]">{s.syntax}</code>
              <div className="text-[11.5px] text-fg-3">{s.text}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11.5px] text-fg-3">
        <Trans
          k="developer.code.signalsNote"
          tags={{ code: (c) => <code className="text-ember">{c}</code> }}
          vars={{ chars: limits.sourceChars !== undefined ? f.number(limits.sourceChars, 0) : "", statements: limits.statements, nodes: limits.nodes !== undefined ? f.number(limits.nodes, 0) : "", period: limits.period }}
        />
      </p>
    </details>
  );
}
