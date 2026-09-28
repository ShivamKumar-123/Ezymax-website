"use client";

// AI assistant (D87): describe a strategy in plain language; Claude returns visual rules or code, validated by
// the service. Follow-up messages edit the strategy currently in the editor.

import * as React from "react";
import { ArrowUp, Bot, Check, CircleHelp, Loader2, Sparkles, Undo2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, Segmented, cn } from "@kalks/ui";
import { SIGNAL_LABEL, algoApi, algoError, type Built, type StrategySpec } from "./api";

interface AiReply {
  configured: boolean;
  model: string;
  target: "visual" | "code";
  status: "ok" | "needs_clarification";
  questions: string[];
  assumptions: string[];
  result: Built;
}

type Msg = { role: "user"; text: string } | { role: "ai"; reply: AiReply; applied: boolean };

const EXAMPLES = [
  "Buy EURUSD on H1 when EMA 20 crosses above EMA 50 and RSI is below 70; sell on the opposite cross. 0.1 lots, stop 25 pips, target 2R.",
  "Gold M15 breakout: buy when close breaks the 20-bar high, only 08:00–17:00, risk 1% with a 1.5 ATR stop and trailing 200 points.",
  "Bitcoin H4: buy a bullish engulfing candle above the 200 SMA, max 2 trades a day, 0.05 lots, stop 2%.",
];

export function AiAssistant({ configured, mode, symbol, timeframe, current, onApply }: { configured: boolean; mode: "visual" | "code"; symbol: string; timeframe: string; current: StrategySpec | string | null; onApply: (b: Built, prompt: string) => void }) {
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [target, setTarget] = React.useState<"visual" | "code">(mode);
  const [edit, setEdit] = React.useState(false);
  const list = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setTarget(mode), [mode]);
  React.useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, busy]);

  const send = async (prompt: string) => {
    const p = prompt.trim();
    if (!p || busy) return;
    setMsgs((m) => [...m, { role: "user", text: p }]);
    setText("");
    setBusy(true);
    try {
      const reply = await algoApi<AiReply>("ai/strategy", { body: { prompt: p, symbol, timeframe, target, current: edit ? current : undefined } });
      setMsgs((m) => [...m, { role: "ai", reply, applied: false }]);
    } catch (e) {
      algoError("The assistant couldn't build this strategy", e);
      setMsgs((m) => m.slice(0, -1));
      setText(p);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        icon={<Bot />}
        title="AI assistant"
        subtitle={configured ? "Describe a strategy; Claude drafts it, you review it" : "Not configured on this server"}
        action={<Segmented size="sm" value={target} onChange={setTarget} options={[{ value: "visual", label: "Rules" }, { value: "code", label: "Code" }]} />}
      />
      <div ref={list} className="mt-3 max-h-[420px] min-h-[160px] flex-1 space-y-3 overflow-y-auto px-5 pb-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-[12.5px] text-fg-3">Try one of these, or write your own. Nothing trades until you save, backtest and deploy it.</p>
            {EXAMPLES.map((e) => (
              <button key={e} type="button" disabled={!configured || busy} onClick={() => send(e)} className="block w-full rounded-[12px] border border-line bg-surface-2/50 px-3 py-2 text-left text-[12.5px] text-fg-2 transition hover:border-ember/40 hover:text-fg disabled:opacity-50">
                {e}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-[14px] rounded-tr-[4px] bg-ember-soft px-3 py-2 text-[13px] text-fg">
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-[14px] rounded-tl-[4px] border border-line bg-surface-2/60 px-3 py-2.5 text-[12.5px]">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-gold" />
                <span className="font-medium text-fg">{m.reply.result.spec.name}</span>
                <Chip size="sm" tone={m.reply.status === "ok" ? "up" : "warn"}>
                  {m.reply.status === "ok" ? "Ready" : "Needs input"}
                </Chip>
              </div>
              <div className="mt-1 font-mono text-[11px] text-fg-3">
                {m.reply.result.spec.symbol} · {m.reply.result.spec.timeframe} · {m.reply.target === "code" ? "code" : "rules"}
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(m.reply.result.summary).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className={cn("w-16 shrink-0 text-[11px] uppercase tracking-wide", k === "buy" ? "text-up" : k === "sell" ? "text-down" : "text-gold")}>{SIGNAL_LABEL[k]}</span>
                    <code className="min-w-0 break-words font-mono text-[11.5px] text-fg-2">{v}</code>
                  </div>
                ))}
              </div>
              {m.reply.questions.length > 0 && (
                <div className="mt-2 space-y-1 text-warn">
                  {m.reply.questions.map((q) => (
                    <div key={q} className="flex gap-1.5">
                      <CircleHelp className="mt-0.5 size-3.5 shrink-0" /> {q}
                    </div>
                  ))}
                </div>
              )}
              {m.reply.assumptions.length > 0 && (
                <details className="mt-2 text-fg-3">
                  <summary className="cursor-pointer text-[11.5px]">{m.reply.assumptions.length} assumption{m.reply.assumptions.length > 1 ? "s" : ""}</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px]">
                    {m.reply.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  size="xs"
                  variant={m.applied ? "surface" : "ember"}
                  disabled={m.applied}
                  onClick={() => {
                    const prompt = [...msgs.slice(0, i)].reverse().find((x) => x.role === "user") as { text: string } | undefined;
                    onApply(m.reply.result, prompt?.text ?? "");
                    setMsgs((all) => all.map((x, j) => (j === i && x.role === "ai" ? { ...x, applied: true } : x)));
                    setEdit(true);
                  }}
                >
                  {m.applied ? (
                    <>
                      <Check /> Applied
                    </>
                  ) : (
                    "Apply to editor"
                  )}
                </Button>
                {!m.reply.result.valid && <span className="text-[11px] text-down">{m.reply.result.errors.length} issue(s) to fix</span>}
                <span className="ml-auto text-[10.5px] text-fg-3">{m.reply.model}</span>
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="mr-4 inline-flex items-center gap-2 rounded-[14px] border border-line bg-surface-2/60 px-3 py-2 text-[12.5px] text-fg-3">
            <Loader2 className="size-3.5 animate-spin" /> Drafting the strategy…
          </div>
        )}
      </div>
      <div className="border-t border-line p-3">
        {msgs.length > 0 && (
          <label className="mb-2 flex items-center gap-2 text-[11.5px] text-fg-3">
            <input type="checkbox" checked={edit} onChange={(e) => setEdit(e.target.checked)} className="accent-[var(--k-ember)]" />
            Edit the strategy in the editor (otherwise start fresh)
            {edit && <Undo2 className="size-3" />}
          </label>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={2}
            maxLength={4000}
            disabled={!configured}
            aria-label="Describe your strategy"
            placeholder={configured ? "e.g. Buy gold when RSI(14) crosses above 30 on M15, stop 1.5 ATR, 2R target" : "The AI assistant is not configured"}
            className="min-h-[44px] flex-1 resize-none rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50"
          />
          <Button type="submit" variant="ember" size="sm" disabled={!configured || busy || !text.trim()} aria-label="Send">
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </form>
      </div>
    </Card>
  );
}
