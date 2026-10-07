"use client";

// Engines behind "Ask Kalks AI" on the Overview.
//
// Live: the question goes to the client's support conversation through the same BFF the support chat uses
// (POST /api/support/messages; signed-in session, same-origin, the support service's per-client message and bot
// limits apply). The bot's answer streams over the realtime connection (bot.typing / bot.delta / message), with a
// poll of the conversation as a fallback while an answer is due. Everything stays in the client's support history,
// so "Continue in chat" opens the same conversation and "Talk to a person" is the chat's own hand-over.
//
// Demo: canned answers typed out locally (no network).

import * as React from "react";
import { realtime, type Frame } from "@/lib/realtime";
import { errMsg, type Conversation, type ConvStatus, type Message } from "@/components/support/live-chat";

export type Turn = {
  id: string;
  role: "you" | "bot" | "agent" | "system";
  text: string;
  name?: string | null;
  cites?: { slug: string; title: string }[];
  /** The suggestion this question came from (its extra panel shows under it). */
  chip?: string;
};

export interface AiEngine {
  botName: string;
  turns: Turn[];
  /** The answer being written: null = none, "" = typing dots, text = streamed so far. */
  streaming: string | null;
  waiting: boolean;
  slow: boolean;
  sending: boolean;
  error: string | null;
  /** The support conversation's status (null before the first message). */
  status: ConvStatus | null;
  agentName: string | null;
  ask: (text: string, chip?: string) => void;
  handover: () => void;
  reset: () => void;
}

type Home = { settings: { botName: string; ai: boolean; agentsOnline: number }; conversation: Conversation | null };

async function api<T>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const r = await fetch(`/api/support/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

const SLOW_MS = 25_000;
const GIVE_UP_MS = 120_000;
const POLL_MS = 2_500;

function toTurn(m: Message): Turn {
  return { id: String(m.id), role: m.author === "client" ? "you" : m.author, text: m.body, name: m.authorName, cites: m.meta?.cites };
}

/** The real support bot. `fallbackName` is shown until the broker's bot name has loaded. */
export function useLiveAi(fallbackName: string, unavailable: string): AiEngine {
  const [botName, setBotName] = React.useState(fallbackName);
  const [conv, setConv] = React.useState<Conversation | null>(null);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [waiting, setWaiting] = React.useState(false);
  const [slow, setSlow] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const convRef = React.useRef<Conversation | null>(null);
  const lastAsked = React.useRef(0); // id of the client message we're waiting on
  const waitingRef = React.useRef(false);
  const since = React.useRef(0);
  convRef.current = conv;
  waitingRef.current = waiting;

  // the broker's bot name and any open conversation (a chat with an agent in progress shows a notice)
  React.useEffect(() => {
    let alive = true;
    void api<Home>("me").then((r) => {
      if (!alive || !r.ok) return;
      if (r.data.settings?.botName) setBotName(r.data.settings.botName);
      setConv((c) => c ?? r.data.conversation);
    });
    return () => {
      alive = false;
    };
  }, []);

  const take = React.useCallback((m: Message) => {
    const cur = convRef.current;
    if (!cur || m.conversationId !== cur.id || m.id <= lastAsked.current || m.author === "client") return;
    setTurns((ts) => (ts.some((x) => x.id === String(m.id)) ? ts : [...ts, toTurn(m)]));
    if (m.author === "bot" || m.author === "agent") {
      setStreaming(null);
      setWaiting(false);
      setSlow(false);
    }
  }, []);

  React.useEffect(
    () =>
      realtime().subscribe((f: Frame) => {
        const cur = convRef.current;
        switch (f.type) {
          case "bot.typing":
            if (cur && f.conversationId === cur.id && waitingRef.current) setStreaming((s) => s ?? "");
            break;
          case "bot.delta":
            if (cur && f.conversationId === cur.id && waitingRef.current) setStreaming((s) => (s ?? "") + String(f.text ?? ""));
            break;
          case "message":
            take(f.message as Message);
            break;
          case "conversation": {
            const c = f.conversation as Conversation;
            if (!cur || c.id === cur.id) setConv(c);
            break;
          }
        }
      }),
    [take],
  );

  // fallback while an answer is due: read the conversation (a missed frame or a stream that's down)
  React.useEffect(() => {
    if (!waiting) return;
    since.current = Date.now();
    const tick = async () => {
      const cur = convRef.current;
      if (!cur) return;
      const r = await api<{ conversation: Conversation; messages: Message[] }>(`conversations/${cur.id}`);
      if (!r.ok) return;
      setConv(r.data.conversation);
      r.data.messages.forEach(take);
      const elapsed = Date.now() - since.current;
      if (elapsed > SLOW_MS) setSlow(true);
      if (elapsed > GIVE_UP_MS) {
        setWaiting(false);
        setStreaming(null);
      }
    };
    const id = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(id);
  }, [waiting, take]);

  const ask = React.useCallback(
    (raw: string, chip?: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      const tmp = `tmp-${Date.now()}`;
      setError(null);
      setSending(true);
      setSlow(false);
      setTurns((ts) => [...ts, { id: tmp, role: "you", text, chip }]);
      // typing dots straight away; the answer streams in as soon as the bot starts
      setWaiting(true);
      setStreaming(convRef.current && convRef.current.status !== "bot" && convRef.current.status !== "resolved" ? null : "");
      void api<{ conversation: Conversation; message: Message }>("messages", { body: text }).then((r) => {
        setSending(false);
        if (!r.ok || !r.data.message) {
          setTurns((ts) => ts.filter((x) => x.id !== tmp));
          setWaiting(false);
          setStreaming(null);
          setError(r.status === 0 ? unavailable : errMsg(r.data, unavailable));
          return;
        }
        lastAsked.current = r.data.message.id;
        setConv(r.data.conversation);
        setTurns((ts) => ts.map((x) => (x.id === tmp ? { ...x, id: String(r.data.message.id) } : x)));
        // the bot answers conversations it owns; with a person on the chat the reply comes from them
        if (r.data.conversation.status !== "bot") setStreaming(null);
      });
    },
    [sending, unavailable],
  );

  const handover = React.useCallback(() => {
    setError(null);
    void api<{ conversation: Conversation }>("handover", {}).then((r) => {
      if (!r.ok) return setError(errMsg(r.data, unavailable));
      setConv(r.data.conversation);
      setStreaming(null);
      // the hand-over notice and the agent's first reply arrive as messages
      setWaiting(true);
    });
  }, [unavailable]);

  const reset = React.useCallback(() => {
    setTurns([]);
    setStreaming(null);
    setWaiting(false);
    setSlow(false);
    setError(null);
  }, []);

  return { botName, turns, streaming, waiting, slow, sending, error, status: conv?.status ?? null, agentName: conv?.assigneeName ?? null, ask, handover, reset };
}

/** Demo builds: answers from `answer`, typed out locally. */
export function useDemoAi(botName: string, answer: (q: string, chip?: string) => string, agent: { name: string; reply: (q: string) => string }, connecting: string): AiEngine {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<ConvStatus | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const n = React.useRef(0);
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const type = (full: string, role: Turn["role"], name?: string) => {
    setStreaming("");
    let i = 0;
    const step = () => {
      i = Math.min(full.length, i + 3);
      setStreaming(full.slice(0, i));
      if (i < full.length) later(step, 16);
      else {
        setStreaming(null);
        setTurns((ts) => [...ts, { id: `d${++n.current}`, role, text: full, name }]);
      }
    };
    later(step, 650);
  };

  return {
    botName,
    turns,
    streaming,
    waiting: streaming !== null,
    slow: false,
    sending: false,
    error: null,
    status,
    agentName: status === "assigned" ? agent.name : null,
    ask: (raw, chip) => {
      const text = raw.trim();
      if (!text || streaming !== null) return;
      setTurns((ts) => [...ts, { id: `d${++n.current}`, role: "you", text, chip }]);
      if (status === "assigned") type(agent.reply(text), "agent", agent.name);
      else {
        setStatus("bot");
        type(answer(text, chip), "bot");
      }
    },
    handover: () => {
      setStatus("waiting");
      setTurns((ts) => [...ts, { id: `d${++n.current}`, role: "system", text: connecting }]);
      later(() => {
        setStatus("assigned");
        const last = [...turns].reverse().find((x) => x.role === "you")?.text ?? "";
        type(agent.reply(last), "agent", agent.name);
      }, 1400);
    },
    reset: () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setTurns([]);
      setStreaming(null);
    },
  };
}
