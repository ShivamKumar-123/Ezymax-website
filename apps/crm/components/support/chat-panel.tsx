"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { FileText, Mail, MoreHorizontal, Paperclip, RotateCcw, SendHorizontal, Sparkles, Star, UserRound } from "lucide-react";
import { Avatar, Chip, IconButton, Menu, cn } from "@kalks/ui";
import { ME } from "@kalks/mock";
import { QUICK_REPLIES, SUPPORT_AGENT, agentAnswer, botAnswer } from "@kalks/mock/support-extra";

type From = "bot" | "user" | "agent" | "system";
interface Msg {
  id: number;
  from: From;
  text: string;
  time: string;
  file?: { name: string; size: string };
  join?: boolean;
}

const SEED: Msg[] = [
  { id: 1, from: "system", text: "Chat started · Thu 24 Sep, 18:31 GMT+3", time: "18:31" },
  { id: 2, from: "bot", text: "Hi Arjun, I'm **Kalks AI**. I can check deposits, withdrawals, accounts and trading questions instantly, or connect you with our support team.", time: "18:31" },
  { id: 3, from: "user", text: "My withdrawal from earlier still shows processing", time: "18:32" },
  { id: 4, from: "bot", text: botAnswer("withdraw").text, time: "18:32" },
  { id: 5, from: "user", text: "Can I talk to a human?", time: "18:33" },
  { id: 6, from: "bot", text: botAnswer("human").text, time: "18:33" },
  { id: 7, from: "system", text: `${SUPPORT_AGENT.name} joined the chat`, time: "18:33", join: true },
  { id: 8, from: "agent", text: "Hi Arjun, Mei Lin here from Client Support. I can see TX904375 for 2,500.00 USDT. It cleared our risk check and I'm confirming the broadcast with the payments desk now.", time: "18:34" },
];

const FRESH: Msg[] = [
  { id: 1, from: "system", text: "New chat · replies in under 5 seconds", time: "" },
  { id: 2, from: "bot", text: "Hi Arjun, I'm **Kalks AI**. How can I help you today? Pick a topic below or type your question.", time: "" },
];

/** Server clock (GMT+3) continuing from the seeded conversation at 18:34. */
const T0 = typeof window === "undefined" ? 0 : Date.now();
function nowHHMM() {
  const mins = 18 * 60 + 34 + Math.floor((Date.now() - T0) / 60000);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-fg">
            {p}
          </strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export function BotAvatar({ size = 32 }: { size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full bg-ember text-white" style={{ width: size, height: size }}>
      <Sparkles style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}

function Typing({ who }: { who: "bot" | "agent" }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-end gap-2.5">
      {who === "bot" ? <BotAvatar size={28} /> : <Avatar src={SUPPORT_AGENT.photo} name={SUPPORT_AGENT.name} size={28} />}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-surface-2 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="size-1.5 rounded-full bg-fg-2" animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </motion.div>
  );
}

export function ChatPanel({ variant = "page", onClose }: { variant?: "page" | "widget"; onClose?: () => void } = {}) {
  const widget = variant === "widget";
  const [msgs, setMsgs] = React.useState<Msg[]>(widget ? FRESH : SEED);
  const [agent, setAgent] = React.useState(!widget);
  const [queued, setQueued] = React.useState(false);
  const [typing, setTyping] = React.useState<null | "bot" | "agent">(null);
  const [input, setInput] = React.useState("");
  const [rated, setRated] = React.useState(0);
  const scroller = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const idRef = React.useRef(100);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);
  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const push = (m: Omit<Msg, "id" | "time">) => setMsgs((x) => [...x, { ...m, id: ++idRef.current, time: nowHHMM() }]);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  const respond = (text: string, isAgent: boolean) => {
    if (isAgent) {
      setTyping("agent");
      later(1600, () => {
        setTyping(null);
        push({ from: "agent", text: agentAnswer(text) });
      });
      return;
    }
    setTyping("bot");
    later(900, () => {
      setTyping(null);
      const a = botAnswer(text);
      push({ from: "bot", text: a.text });
      if (a.handoff) {
        later(1300, () => {
          push({ from: "system", text: `${SUPPORT_AGENT.name} joined the chat`, join: true });
          setAgent(true);
          setTyping("agent");
          later(1500, () => {
            setTyping(null);
            push({ from: "agent", text: "Hi Arjun, Mei Lin here from Client Support. I've read your conversation with Kalks AI. How can I help?" });
          });
        });
      }
    });
  };

  /** Bot first; the user can ask for a person at any time → queue notice → agent joins with the transcript. */
  const requestHuman = () => {
    if (agent || queued) return;
    setQueued(true);
    push({ from: "user", text: "I'd like to talk to a person" });
    setTyping("bot");
    later(700, () => {
      setTyping(null);
      push({ from: "bot", text: "Of course. I've passed our conversation to the support team so you won't need to repeat anything." });
      push({ from: "system", text: "Request sent · you're #1 in the queue · estimated wait under 1 min", time: "" } as Omit<Msg, "id" | "time">);
      later(2200, () => {
        push({ from: "system", text: `${SUPPORT_AGENT.name} joined the chat`, join: true });
        setAgent(true);
        setQueued(false);
        setTyping("agent");
        later(1400, () => {
          setTyping(null);
          push({ from: "agent", text: `Hi ${ME.firstName}, ${SUPPORT_AGENT.name.split(" ")[0]} here from Client Support. I've read your chat with Kalks AI. How can I help?` });
        });
      });
    });
  };

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || typing) return;
    setInput("");
    push({ from: "user", text });
    respond(text, agent);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    push({ from: "user", text: "", file: { name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` } });
    toast.success("File uploaded", { description: f.name });
    e.target.value = "";
    setTyping(agent ? "agent" : "bot");
    later(1200, () => {
      setTyping(null);
      push({ from: agent ? "agent" : "bot", text: `Thanks, I've received **${f.name}** and attached it to your case. Our team will review it shortly.` });
    });
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setTyping(null);
    setAgent(false);
    setQueued(false);
    setRated(0);
    setMsgs(FRESH);
    toast.success("New conversation started");
  };

  return (
    <div className={cn("k-card flex flex-col overflow-hidden", widget ? "h-full rounded-[18px]" : "h-[720px] xl:h-full xl:min-h-[720px]")}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        {agent ? (
          <div className="relative flex items-center">
            <BotAvatar size={30} />
            <Avatar src={SUPPORT_AGENT.photo} name={SUPPORT_AGENT.name} size={38} online className="-ml-2.5 ring-2 ring-surface rounded-full" />
          </div>
        ) : (
          <BotAvatar size={38} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[15px] font-medium">
            {agent ? SUPPORT_AGENT.name : "Kalks AI"}
            <Chip size="sm" tone={agent ? "up" : "ember"} dot>
              {agent ? "Live agent" : "AI assistant"}
            </Chip>
          </div>
          <div className="truncate text-[12px] text-fg-3">{agent ? `${SUPPORT_AGENT.role} · ${SUPPORT_AGENT.languages.join(", ")}` : "Answers instantly · hands over to a human anytime"}</div>
        </div>
        <Menu
          trigger={
            <IconButton size="sm" aria-label="Chat options">
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: "Email transcript", icon: <Mail />, onSelect: () => toast.success("Transcript sent", { description: ME.email }) },
            { label: "Talk to a human", icon: <UserRound />, onSelect: () => (agent ? toast.info(`You're already chatting with ${SUPPORT_AGENT.name.split(" ")[0]}`) : requestHuman()) },
            "sep",
            { label: "Start new chat", icon: <RotateCcw />, onSelect: reset },
          ]}
        />
      </div>

      {/* Messages */}
      <div ref={scroller} className="flex flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-5">
        <div className="mt-auto space-y-4">
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            if (m.from === "system")
              return (
                <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                  {m.join ? (
                    <div className="flex items-center gap-2.5 rounded-full border border-up/25 bg-up-soft py-1 pl-1 pr-3.5 text-[12px] text-fg-2">
                      <Avatar src={SUPPORT_AGENT.photo} name={SUPPORT_AGENT.name} size={24} />
                      <span>
                        Agent joined: <span className="font-medium text-fg">{SUPPORT_AGENT.name}</span>
                      </span>
                      {m.time && <span className="font-mono text-[10.5px] text-fg-3">{m.time}</span>}
                    </div>
                  ) : (
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] text-fg-3">{m.text}</span>
                  )}
                </motion.div>
              );
            const mine = m.from === "user";
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25 }} className={cn("flex items-end gap-2.5", mine && "flex-row-reverse")}>
                {m.from === "bot" && <BotAvatar size={28} />}
                {m.from === "agent" && <Avatar src={SUPPORT_AGENT.photo} name={SUPPORT_AGENT.name} size={28} />}
                {mine && <Avatar src={ME.photo} name={ME.name} size={28} />}
                <div className={cn("max-w-[78%]", mine && "text-right")}>
                  <div className={cn("mb-1 flex items-center gap-2 text-[11px] text-fg-3", mine && "justify-end")}>
                    <span className="font-medium text-fg-2">{mine ? "You" : m.from === "bot" ? "Kalks AI" : SUPPORT_AGENT.name}</span>
                    {m.time && <span className="font-mono">{m.time}</span>}
                  </div>
                  {m.file ? (
                    <div className="inline-flex items-center gap-3 rounded-2xl rounded-br-md border border-ember/30 bg-ember-soft px-3.5 py-2.5 text-left">
                      <span className="grid size-9 place-items-center rounded-xl bg-surface-3 text-ember">
                        <FileText className="size-4" />
                      </span>
                      <div>
                        <div className="max-w-[180px] truncate text-[13px] font-medium">{m.file.name}</div>
                        <div className="text-[11px] text-fg-3">{m.file.size} · uploaded</div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "inline-block rounded-2xl px-4 py-2.5 text-left text-[13.5px] leading-relaxed",
                        mine ? "rounded-br-md bg-gradient-to-br from-[#ff7a2f] to-[#e8431a] text-white" : m.from === "bot" ? "rounded-bl-md border border-ember/20 bg-surface-2 text-fg-2" : "rounded-bl-md border border-line bg-surface-3 text-fg",
                      )}
                    >
                      <Rich text={m.text} />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          {typing && <Typing key="typing" who={typing} />}
        </AnimatePresence>
        {agent && msgs.length > 6 && (
          <div className="mx-auto max-w-xs rounded-2xl border border-line bg-surface-2 px-4 py-3 text-center">
            <div className="text-[12px] text-fg-2">How is {SUPPORT_AGENT.name.split(" ")[0]} doing?</div>
            <div className="mt-1.5 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  aria-label={`${n} stars`}
                  onClick={() => {
                    setRated(n);
                    toast.success("Thanks for your feedback");
                  }}
                  className={cn("transition-colors", n <= rated ? "text-gold" : "text-fg-3 hover:text-gold")}
                >
                  <Star className={cn("size-4", n <= rated && "fill-current")} />
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-line px-4 pb-4 pt-3 sm:px-5">
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_REPLIES.map((q) => (
            <button key={q} onClick={() => send(q)} disabled={!!typing} className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-fg-2 transition-colors hover:border-ember/40 hover:text-fg disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 rounded-[18px] border border-line bg-surface-2 p-1.5 pl-2 transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10"
        >
          <input ref={fileRef} type="file" className="hidden" onChange={onFile} accept="image/*,.pdf" />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach file" className="grid size-9 shrink-0 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg">
            <Paperclip className="size-4" />
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={agent ? `Message ${SUPPORT_AGENT.name.split(" ")[0]}…` : "Ask Kalks AI anything…"} className="h-9 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-3" />
          <button type="submit" disabled={!input.trim() || !!typing} aria-label="Send" className="k-ember-btn grid size-9 shrink-0 place-items-center rounded-full transition-opacity disabled:opacity-40">
            <SendHorizontal className="size-4" />
          </button>
        </form>
        <div className="mt-2 text-center text-[10.5px] text-fg-3">Kalks AI can make mistakes. A human agent is available 24/7 · chats are recorded for quality.</div>
      </div>
    </div>
  );
}
