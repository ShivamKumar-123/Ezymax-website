"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Copy, FileCode2, RotateCcw, ShieldCheck, TriangleAlert, Check } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Tooltip, cn } from "@/components/kit";
import { validateCode } from "@ezymex/mock/algo";

const TOKEN =
  /(#.*$)|("[^"]*")|\b(strategy|when|and|or|not|all|any|if|else|True|False)\b|\b(buy|sell)\b(?=\()|\b([a-z_][a-z0-9_]*)(?=\()|(\.[a-z_]+)|\b(symbol|timeframe|session|lots|risk_pct|sl|tp|stop|start|close)\b|\b([A-Z]{2}[A-Z0-9]{2,}|[MHD]\d{1,2})\b|(\d+(?:\.\d+)?)|([=*<>+\-/]+|[(),:])/g;

const CLS = [
  "text-fg-3 italic", // comment
  "text-up", // string
  "text-ember font-medium", // keyword
  "", // buy/sell (special)
  "text-gold", // function
  "text-gold/75", // attribute
  "text-fg-2", // params
  "text-warn", // constants
  "text-info", // numbers
  "text-fg-3", // operators
];

function highlight(line: string, key: number) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const g = m.slice(1).findIndex((x) => x !== undefined);
    const text = m[0];
    const cls = g === 3 ? (text === "buy" ? "text-up font-semibold" : "text-down font-semibold") : CLS[g];
    out.push(
      <span key={`${key}-${i}`} className={cls}>
        {text}
      </span>,
    );
    last = i + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

const LH = 22; // px line height

export function CodeEditor({
  code,
  generated,
  fileName,
  onChange,
  onReset,
}: {
  code: string;
  generated: boolean;
  fileName: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const lines = code.split("\n");
  const [log, setLog] = React.useState<{ ok: boolean; text: string; t: number } | null>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  const validate = () => {
    const res = validateCode(code);
    const ms = 24 + (code.length % 37);
    if (res.ok) {
      toast.success("Compiled OK · 0 warnings", { description: `${fileName} · ${lines.length} lines · ${ms}ms` });
      setLog({ ok: true, text: `Compiled ${fileName} in ${ms}ms · 0 errors · 0 warnings · ready to deploy`, t: Date.now() });
    } else {
      toast.error(`Line ${res.line}: ${res.message}`);
      setLog({ ok: false, text: `${fileName}:${res.line} · ${res.message}`, t: Date.now() });
    }
  };

  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-bg shadow-[inset_0_1px_0_var(--k-border-top)]">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
        <div className="flex items-center gap-1.5 pl-1">
          <span className="size-2.5 rounded-full bg-down/70" />
          <span className="size-2.5 rounded-full bg-warn/70" />
          <span className="size-2.5 rounded-full bg-up/70" />
        </div>
        <span className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 font-mono text-[12px] text-fg-2">
          <FileCode2 className="size-3.5 text-ember" />
          {fileName}
          {!generated && <span className="size-1.5 rounded-full bg-ember" title="Edited" />}
        </span>
        <Chip size="sm" tone={generated ? "neutral" : "ember"}>
          {generated ? "Synced with visual" : "Hand-edited"}
        </Chip>
        <div className="ml-auto flex items-center gap-1.5">
          {!generated && (
            <Tooltip content="Discard edits and regenerate from the visual rules">
              <Button size="xs" variant="ghost" onClick={onReset}>
                <RotateCcw /> Regenerate
              </Button>
            </Tooltip>
          )}
          <Button
            size="xs"
            variant="surface"
            onClick={() => {
              navigator.clipboard?.writeText(code).catch(() => {});
              toast.success("Strategy code copied", { description: `${lines.length} lines` });
            }}
          >
            <Copy /> Copy
          </Button>
          <Button size="xs" variant="ember" onClick={validate}>
            <ShieldCheck /> Validate
          </Button>
        </div>
      </div>

      {/* editor */}
      <div className="flex max-h-[520px] overflow-auto font-mono text-[12.5px]" style={{ lineHeight: `${LH}px` }}>
        <div aria-hidden className="sticky left-0 z-10 shrink-0 select-none border-r border-line bg-bg py-3 pl-3 pr-3 text-right text-fg-3/70">
          {lines.map((_, i) => (
            <div key={i} className="k-num" style={{ height: LH }}>
              {i + 1}
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative inline-block min-w-full">
            <pre aria-hidden className="m-0 whitespace-pre px-4 py-3 text-fg">
              {lines.map((l, i) => (
                <div key={i} style={{ height: LH }}>
                  {l ? highlight(l, i) : " "}
                </div>
              ))}
            </pre>
            <textarea
              ref={taRef}
              value={code}
              spellCheck={false}
              wrap="off"
              aria-label="Strategy code"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const s = el.selectionStart;
                  const next = code.slice(0, s) + "    " + code.slice(el.selectionEnd);
                  onChange(next);
                  requestAnimationFrame(() => {
                    taRef.current?.setSelectionRange(s + 4, s + 4);
                  });
                }
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  validate();
                }
              }}
              className="absolute inset-0 m-0 h-full w-full resize-none overflow-hidden whitespace-pre bg-transparent px-4 py-3 font-mono text-transparent caret-ember outline-none selection:bg-ember/25"
              style={{ lineHeight: `${LH}px`, fontSize: "12.5px" }}
            />
          </div>
        </div>
      </div>

      {/* console */}
      <div className="flex items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-2 font-mono text-[11.5px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={log?.t ?? 0} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("flex min-w-0 items-center gap-2 truncate", log ? (log.ok ? "text-up" : "text-down") : "text-fg-3")}>
            {log ? log.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <TriangleAlert className="size-3.5 shrink-0" /> : <span className="text-ember">›</span>}
            <span className="truncate">{log ? log.text : "ezymex compile — press Validate or ⌘S"}</span>
          </motion.span>
        </AnimatePresence>
        <span className="ml-auto hidden shrink-0 text-fg-3 sm:inline">
          Ln {lines.length} · UTF-8 · Ezymex DSL 2.4
        </span>
      </div>
    </div>
  );
}
