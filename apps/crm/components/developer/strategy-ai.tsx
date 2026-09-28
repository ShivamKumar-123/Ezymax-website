"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, Sparkles, Undo2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Card, CardHeader, Chip, cn } from "@kalks/ui";
import { ME } from "@kalks/mock";
import { AI_SUGGESTIONS, aiDraft, type StrategyRules } from "@kalks/mock/algo";

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
  applied?: string;
}

const GREETING =
  "Hi Arjun — describe a strategy in plain English and I'll turn it into rules. Mention the symbol, timeframe, entry idea and how much you want to risk.";

export function AiAssistant({ onApply, onUndo }: { onApply: (rules: StrategyRules, templateId: string) => void; onUndo: () => void }) {
  const [msgs, setMsgs] = React.useState<Msg[]>([{ id: 0, role: "ai", text: GREETING }]);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<"thinking" | "typing" | null>(null);
  const [typed, setTyped] = React.useState(0);
  const scroller = React.useRef<HTMLDivElement>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typed, busy]);

  function ask(text: string) {
    if (!text.trim() || busy) return;
    const draft = aiDraft(text);
    const uid = Date.now();
    setMsgs((m) => [...m, { id: uid, role: "user", text }]);
    setQ("");
    setBusy("thinking");
    timers.current.push(
      setTimeout(() => {
        setMsgs((m) => [...m, { id: uid + 1, role: "ai", text: draft.reply }]);
        setTyped(0);
        setBusy("typing");
        let i = 0;
        const tick = () => {
          i += 3;
          setTyped(i);
          if (i < draft.reply.length) timers.current.push(setTimeout(tick, 14));
          else {
            setBusy(null);
            onApply(draft.rules, draft.templateId);
            setMsgs((m) => m.map((x) => (x.id === uid + 1 ? { ...x, applied: draft.rules.name } : x)));
            toast.success("Rules applied to builder", { description: draft.rules.name });
          }
        };
        tick();
      }, 700),
    );
  }

  const lastAi = [...msgs].reverse().find((m) => m.role === "ai");

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Strategy AI
            <Chip size="sm" tone="ember">
              <Sparkles className="size-3" /> Claude
            </Chip>
          </span>
        }
        subtitle="Natural language → trading rules"
      />
      <div ref={scroller} className="mt-4 max-h-[300px] min-h-[120px] flex-1 space-y-3 overflow-y-auto px-4 [scrollbar-width:thin] sm:px-5">
        {msgs.map((m) => {
          const streaming = busy === "typing" && m.id === lastAi?.id && m.role === "ai" && !m.applied && m.id !== 0;
          const text = streaming ? m.text.slice(0, typed) : m.text;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              {m.role === "ai" ? (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff9a57,#e8431a)] text-white shadow-[0_0_18px_-4px_rgba(255,90,31,0.8)]">
                  <Sparkles className="size-3.5" />
                </span>
              ) : (
                <Avatar src={ME.photo} name={ME.name} size={28} />
              )}
              <div className={cn("max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[13px] leading-relaxed", m.role === "ai" ? "rounded-tl-md border border-line bg-surface-2 text-fg-2" : "rounded-tr-md bg-surface-3 text-fg")}>
                <p className="whitespace-pre-line">
                  {text}
                  {streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ember align-middle" />}
                </p>
                {m.applied && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                    <Chip size="sm" tone="up">
                      <Check className="size-3" /> Applied
                    </Chip>
                    <button
                      onClick={() => {
                        onUndo();
                        toast("Reverted to previous rules");
                      }}
                      className="inline-flex items-center gap-1 text-[11.5px] text-fg-3 hover:text-fg"
                    >
                      <Undo2 className="size-3" /> Undo
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        <AnimatePresence>
          {busy === "thinking" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff9a57,#e8431a)] text-white">
                <Sparkles className="size-3.5 animate-pulse" />
              </span>
              <span className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="size-1.5 rounded-full bg-ember" animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                ))}
                <span className="ml-1.5 text-[11.5px] text-fg-3">Mapping to rules…</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 pb-5 pt-4 sm:px-5">
        <div className="mb-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {AI_SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} disabled={!!busy} className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11.5px] text-fg-2 transition-colors hover:border-ember/40 hover:text-fg disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <div className="rounded-[18px] p-px [background:linear-gradient(135deg,rgba(255,138,61,0.9),rgba(255,90,31,0.25)_40%,rgba(255,255,255,0.06)_70%,rgba(255,90,31,0.6))] shadow-[0_14px_40px_-18px_rgba(255,90,31,0.7)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
            className="flex items-end gap-2 rounded-[17px] bg-surface p-1.5"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ff9a57,#e8431a)] text-white shadow-[0_0_20px_-4px_rgba(255,90,31,0.8)]">
              <Wand2 className="size-4" />
            </span>
            <textarea
              value={q}
              rows={2}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(q);
                }
              }}
              placeholder="Describe your strategy…"
              className="min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-[13px] leading-snug outline-none placeholder:text-fg-3"
            />
            <button type="submit" disabled={!q.trim() || !!busy} className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-line transition-colors", q.trim() ? "bg-fg text-bg" : "bg-surface-3 text-fg-3")} aria-label="Send">
              <ArrowUp className="size-4" />
            </button>
          </form>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-fg-3">AI drafts rules only — nothing trades until you deploy.</p>
      </div>
    </Card>
  );
}
