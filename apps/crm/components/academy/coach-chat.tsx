"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Bot, Copy, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Chip, IconButton, SymbolAvatar, cn, formatMoney } from "@/components/kit";
import { ME } from "@kalks/mock";
import { COACH } from "@kalks/mock/academy";

/* ------------------------------------------------------------------ */
/* Message model                                                       */
/* ------------------------------------------------------------------ */

type Stat = { label: string; value: string; tone?: "up" | "down" | "gold" };
interface Msg {
  id: string;
  role: "coach" | "user";
  text: string;
  stats?: Stat[];
  bullets?: string[];
  symbols?: { symbol: string; value: number }[];
  time: string;
}

const money = (v: number) => `${v >= 0 ? "+" : "-"}${formatMoney(Math.abs(v))}`;

function weeklyReview(): Omit<Msg, "id" | "time"> {
  const w = COACH.week;
  const p = COACH.prevWeek;
  return {
    role: "coach",
    text: `Hi ${ME.firstName} — here's your **weekly review** (18–24 Sep). You closed **${w.count} trades** with a **${w.winRate.toFixed(1)}% win rate** and **${money(w.net)}** net. Win rate is up from ${p.winRate.toFixed(0)}% last week, but profit fell sharply: your average loss (**${formatMoney(w.avgLoss)}**) is now bigger than your average win (**${formatMoney(w.avgWin)}**). That's the one thing to fix next week.`,
    stats: [
      { label: "Net P/L", value: money(w.net), tone: w.net >= 0 ? "up" : "down" },
      { label: "Win rate", value: `${w.winRate.toFixed(1)}%` },
      { label: "Profit factor", value: w.profitFactor.toFixed(2), tone: "gold" },
      { label: "Volume", value: `${w.lots} lots` },
    ],
    symbols: [
      { symbol: COACH.weekBest.symbol, value: COACH.weekBest.profit },
      { symbol: COACH.weekWorst.symbol, value: COACH.weekWorst.profit },
    ],
    bullets: [
      `**Best trade:** ${COACH.weekBest.symbol} ${COACH.weekBest.side.toUpperCase()} ${COACH.weekBest.volume} lot, ${money(COACH.weekBest.profit)}.`,
      `**Worst trade:** ${COACH.weekWorst.symbol} ${COACH.weekWorst.side.toUpperCase()} ${COACH.weekWorst.volume} lot, ${money(COACH.weekWorst.profit)} — held past your usual stop.`,
      `**New York session** is your edge: ${money(COACH.sessionNet[2]!.net)} all-time vs ${money(COACH.sessionNet[0]!.net)} in Asia.`,
      "**Next week:** cap risk at 1% per trade and take a 20-min break after any loss over $150.",
    ],
  };
}

function reply(q: string): Omit<Msg, "id" | "time"> {
  const s = q.toLowerCase();
  const best = COACH.bySymbol[0]!;
  const worst = COACH.bySymbol.at(-1)!;
  if (s.includes("gold") || s.includes("xau") || s.includes("best")) {
    return {
      role: "coach",
      text: `**${best.symbol}** is by far your strongest market: **${money(best.net)}** across ${best.count} trades with a **${best.winRate.toFixed(0)}% win rate**. You do best buying pullbacks into the Asian range low and letting winners run into London. Consider giving gold a slightly larger share of your risk budget — but keep the 1% cap per trade.`,
      symbols: COACH.bySymbol.slice(0, 3).map((x) => ({ symbol: x.symbol, value: x.net })),
    };
  }
  if (s.includes("worst") || s.includes("oil") || s.includes("stop trading") || s.includes("avoid")) {
    return {
      role: "coach",
      text: `Your weakest symbol is **${worst.symbol}** (**${money(worst.net)}** over ${worst.count} trades, ${worst.winRate.toFixed(0)}% win rate). ${COACH.bySymbol.slice(-3).map((x) => x.symbol).join(", ")} are all net negative. They share one pattern: you trade them without a written plan, usually after a winning streak elsewhere.`,
      symbols: COACH.bySymbol.slice(-3).map((x) => ({ symbol: x.symbol, value: x.net })),
      bullets: ["Remove USOIL from your watchlist for 2 weeks and track what you'd have done on demo.", "Only trade AUDUSD during the Sydney–Tokyo overlap, where your few wins came from."],
    };
  }
  if (s.includes("risk") || s.includes("size") || s.includes("lot")) {
    const rb = COACH.riskBuckets;
    const big = rb[3]!.count + rb[4]!.count;
    return {
      role: "coach",
      text: `Most of your trades risk under **0.5%** of equity — good discipline. But **${big} trades** risked more than 2%, and ${rb[4]!.count} risked over 3%. Those outsized trades account for most of your drawdown days. A fixed-fractional rule (e.g. risk = 1% × equity ÷ stop distance) would have cut your max drawdown roughly in half.`,
      stats: rb.map((b) => ({ label: b.label, value: `${b.count}`, tone: b.label.startsWith(">") || b.label.startsWith("2") ? ("down" as const) : undefined })).slice(0, 4),
    };
  }
  if (s.includes("time") || s.includes("session") || s.includes("when") || s.includes("hour")) {
    return {
      role: "coach",
      text: `Your best window is the **New York session** (16:00–24:00 server time), especially **Thursday and Friday afternoons**. Asia is profitable but thin. Your weak spots are **Wednesday London** and **Friday Asia**, both net negative. Try blocking those two windows for the next two weeks.`,
      stats: COACH.sessionNet.map((x) => ({ label: x.session, value: money(x.net), tone: x.net >= 0 ? ("up" as const) : ("down" as const) })),
    };
  }
  if (s.includes("loss") || s.includes("revenge") || s.includes("tilt") || s.includes("overtrad")) {
    const flagged = COACH.overtrading.days.filter((d) => d.afterLoss).length;
    return {
      role: "coach",
      text: `I found **${flagged} days** in the last month where you traded noticeably more than usual (avg ${COACH.overtrading.avg}/day) right after a losing day. On those days your average trade was worse, and your 23 Sep journal note mentions a revenge trade on NAS100. A simple circuit breaker helps: after 2 consecutive losses, stop for the session.`,
      bullets: ["Enable **daily loss limit** on account #80412337 (Settings → Risk).", "Journal every loss above $150 before placing the next trade."],
    };
  }
  if (s.includes("week") || s.includes("summary") || s.includes("review")) return weeklyReview();
  return {
    role: "coach",
    text: `Good question. Looking at your last ${COACH.allTime.count} closed trades (**${money(COACH.allTime.net)}** net, ${COACH.allTime.winRate.toFixed(0)}% win rate, profit factor **${COACH.allTime.profitFactor.toFixed(2)}**), the biggest lever isn't finding new setups — it's keeping losses smaller than wins. Ask me about your **best symbols**, **session timing**, **risk per trade** or **trading after losses** for specifics.`,
  };
}

/* ------------------------------------------------------------------ */
/* Markdown-ish inline renderer (**bold**)                             */
/* ------------------------------------------------------------------ */

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]*(?:\*\*|$))/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i} className={cn("font-semibold text-fg", /^\*\*[+]/.test(p) && "text-up", /^\*\*-\$/.test(p) && "text-down")}>
            {p.replace(/\*/g, "")}
          </strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

function CoachAvatar({ size = 32 }: { size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--k-ember-2)] to-[color-mix(in_oklab,var(--k-ember)_78%,#000)] text-white shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--k-ember)_70%,transparent)]" style={{ width: size, height: size }}>
      <Sparkles className="size-[45%]" />
    </span>
  );
}

function Bubble({ m, streamed, done }: { m: Msg; streamed: string; done: boolean }) {
  if (m.role === "user")
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end gap-2.5">
        <div className="max-w-[85%] rounded-[18px] rounded-br-md border border-ember/30 bg-ember-soft px-4 py-2.5 text-[13.5px] leading-relaxed text-fg">{m.text}</div>
        <Avatar src={ME.photo} name={ME.name} size={30} />
      </motion.div>
    );
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
      <CoachAvatar size={30} />
      <div className="min-w-0 max-w-[92%] flex-1">
        <div className="mb-1 flex items-center gap-2 text-[11.5px] text-fg-3">
          <span className="font-medium text-fg-2">Kalks Coach</span> · {m.time}
        </div>
        <div className="rounded-[18px] rounded-tl-md border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed text-fg-2 shadow-[inset_0_1px_0_var(--k-border-top)]">
          <p>
            <Rich text={streamed} />
            {!done && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-ember" />}
          </p>
          <AnimatePresence>
            {done && (m.stats || m.bullets || m.symbols) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.35 }} className="overflow-hidden">
                {m.stats && (
                  <div className={cn("mt-3 grid gap-2", m.stats.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
                    {m.stats.map((s, i) => (
                      <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-xl border border-line bg-surface px-3 py-2">
                        <div className="text-[11px] text-fg-3">{s.label}</div>
                        <div className={cn("k-num mt-0.5 text-[14px] font-semibold", s.tone === "up" ? "text-up" : s.tone === "down" ? "text-down" : s.tone === "gold" ? "text-gold" : "text-fg")}>{s.value}</div>
                      </motion.div>
                    ))}
                  </div>
                )}
                {m.symbols && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.symbols.map((x) => (
                      <span key={x.symbol} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[12px]">
                        <SymbolAvatar symbol={x.symbol} size={18} />
                        <span className="font-medium text-fg">{x.symbol}</span>
                        <span className={cn("k-num font-medium", x.value >= 0 ? "text-up" : "text-down")}>{money(x.value)}</span>
                      </span>
                    ))}
                  </div>
                )}
                {m.bullets && (
                  <ul className="mt-3 space-y-1.5">
                    {m.bullets.map((b) => (
                      <li key={b} className="flex gap-2 text-[13px]">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ember" />
                        <span>
                          <Rich text={b} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {done && (
          <div className="mt-1.5 flex items-center gap-1 text-fg-3">
            {[
              [ThumbsUp, "Thanks for the feedback"],
              [ThumbsDown, "Got it — Coach will adjust future reviews"],
              [Copy, "Copied to clipboard"],
            ].map(([I, msg], i) => {
              const Icon = I as typeof ThumbsUp;
              return (
                <button key={i} onClick={() => toast.success(msg as string)} className="grid size-7 place-items-center rounded-full hover:bg-surface-3 hover:text-fg" aria-label="Feedback">
                  <Icon className="size-3.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const SUGGESTIONS = ["What's my best symbol?", "When should I trade?", "Am I risking too much?", "Do I overtrade after losses?", "Which symbols should I avoid?", "Summarise my week"];

export interface CoachChatHandle {
  ask: (q: string) => void;
}

export const CoachChat = React.forwardRef<CoachChatHandle, { className?: string }>(function CoachChat({ className }, ref) {
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [streamId, setStreamId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [thinking, setThinking] = React.useState(true);
  const [q, setQ] = React.useState("");
  const scroller = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const counter = React.useRef(0);

  const stream = React.useCallback((m: Omit<Msg, "id" | "time">) => {
    const id = `m${++counter.current}`;
    const now = new Date();
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
    setThinking(false);
    setMsgs((x) => [...x, { ...m, id, time }]);
    setStreamId(id);
    setProgress(0);
    if (timer.current) clearInterval(timer.current);
    let i = 0;
    timer.current = setInterval(() => {
      i += 3;
      setProgress(i);
      if (i >= m.text.length) {
        clearInterval(timer.current!);
        setStreamId(null);
      }
    }, 14);
  }, []);

  // Opening weekly review
  React.useEffect(() => {
    const t = setTimeout(() => stream(weeklyReview()), 900);
    return () => {
      clearTimeout(t);
      if (timer.current) clearInterval(timer.current);
    };
  }, [stream]);

  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, progress, thinking]);

  const busy = thinking || streamId !== null;
  const ask = React.useCallback(
    (text: string) => {
      if (!text.trim() || busy) return;
      const id = `m${++counter.current}`;
      setMsgs((x) => [...x, { id, role: "user", text, time: "" }]);
      setQ("");
      setThinking(true);
      setTimeout(() => stream(reply(text)), 700 + Math.min(900, text.length * 12));
    },
    [busy, stream],
  );
  React.useImperativeHandle(ref, () => ({ ask }), [ask]);

  return (
    <div className={cn("k-card flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <CoachAvatar size={40} />
          <div>
            <div className="flex items-center gap-2 text-[15px] font-medium">
              Kalks Coach
              <Chip size="sm" tone="ember">
                AI · Claude
              </Chip>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-fg-3">
              <span className="size-1.5 rounded-full bg-up" /> Analysing {COACH.allTime.count} trades · 3 accounts · journal
            </div>
          </div>
        </div>
        <IconButton
          size="sm"
          aria-label="Regenerate review"
          onClick={() => {
            if (busy) return;
            setMsgs([]);
            setThinking(true);
            setTimeout(() => stream(weeklyReview()), 700);
            toast("Regenerating weekly review…");
          }}
        >
          <RefreshCw />
        </IconButton>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto scroll-smooth px-4 py-5 sm:px-5">
        <div className="flex items-center gap-3 text-[11px] text-fg-3">
          <span className="h-px flex-1 bg-line" /> Weekly review · Wed 24 Sep <span className="h-px flex-1 bg-line" />
        </div>
        {msgs.map((m) => (
          <Bubble key={m.id} m={m} streamed={m.id === streamId ? m.text.slice(0, progress) : m.text} done={m.id !== streamId} />
        ))}
        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
            <CoachAvatar size={30} />
            <div className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="size-1.5 rounded-full bg-fg-2" animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
              ))}
              <span className="ml-2 text-[12px] text-fg-3">Reading your journal & history…</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="border-t border-line px-4 pb-4 pt-3 sm:px-5">
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} disabled={busy} onClick={() => ask(s)} className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-fg-2 transition-colors hover:border-ember/40 hover:bg-ember-soft hover:text-ember disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="flex items-center gap-2 rounded-[20px] border border-ember/30 bg-surface-2 p-1.5 pl-4 shadow-[0_0_0_4px_color-mix(in_oklab,var(--k-ember)_6%,transparent),0_10px_30px_-12px_color-mix(in_oklab,var(--k-ember)_45%,transparent)] focus-within:border-ember/60"
        >
          <Bot className="size-4 shrink-0 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your trading, e.g. “Why did I lose on Friday?”" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-3" />
          <button type="submit" disabled={busy || !q.trim()} className="k-ember-btn grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-40" aria-label="Send">
            <ArrowUp className="size-4" />
          </button>
        </form>
        <div className="mt-2 text-center text-[10.5px] text-fg-3">Coach insights are educational, not financial advice. Based on closed trades up to 24 Sep, 19:00 GMT+3.</div>
      </div>
    </div>
  );
});
