"use client";

// Engines behind "Ask Ezymex AI" on the Overview.
//
// Live: the question goes to the client's support conversation through the same BFF the support chat uses
// (POST /api/support/messages; signed-in session, same-origin, the support service's per-client message and bot
// limits apply). The bot's answer streams over the realtime connection (bot.typing / bot.delta / message), with a
// poll of the conversation as a fallback while an answer is due. Everything stays in the client's support history,
// so "Continue in chat" opens the same conversation and "Talk to a person" is the chat's own hand-over.
// The service keeps one open conversation per client and the bot only answers "bot" conversations (lib/ask-ai.ts):
// while a request for a person is open, a question is held until the client closes that request (then it goes to
// the bot in a new conversation) or sends it to the team.
//
// Demo: canned answers typed out locally (no network).

import * as React from "react";
import { realtime, type Frame } from "@/lib/realtime";
import { errMsg, type Conversation, type ConvStatus, type Message } from "@/components/support/live-chat";
import { askRoute, passedToTeam, withPerson } from "@/lib/ask-ai";

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
  /** A request for a person was already open before this card's questions (shown as a note with "View"). */
  openRequest: boolean;
  /** A question is held: a request for a person is open and the bot can't answer there. */
  blocked: boolean;
  /** The conversation is with our support team now (handed over, or sent to the team). */
  withTeam: boolean;
  ask: (text: string, chip?: string) => void;
  /** Held question: close the open request, then ask the bot (a new conversation). */
  closeAndAsk: () => void;
  /** Held question: send it to the team in the open request instead. */
  sendToTeam: () => void;
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
  const [held, setHeld] = React.useState<{ id: string; text: string } | null>(null);
  const [sentToTeam, setSentToTeam] = React.useState(false);
  const convRef = React.useRef<Conversation | null>(null);
  const lastAsked = React.useRef(0); // id of the client message we're waiting on
  const waitingRef = React.useRef(false);
  const since = React.useRef(0);
  convRef.current = conv;
  waitingRef.current = waiting;

  // the broker's bot name and any open conversation (a request for a person shows a note)
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

  const stopWaiting = React.useCallback(() => {
    setStreaming(null);
    setWaiting(false);
    setSlow(false);
  }, []);

  const onConv = React.useCallback(
    (c: Conversation) => {
      setConv(c);
      // the bot handed the question over: no bot answer is coming
      if (passedToTeam(waitingRef.current, c.status) && c.id === convRef.current?.id && lastAsked.current) stopWaiting();
    },
    [stopWaiting],
  );

  const take = React.useCallback(
    (m: Message) => {
      const cur = convRef.current;
      if (!cur || m.conversationId !== cur.id || m.id <= lastAsked.current || m.author === "client") return;
      setTurns((ts) => (ts.some((x) => x.id === String(m.id)) ? ts : [...ts, toTurn(m)]));
      if (m.author === "bot" || m.author === "agent") stopWaiting();
    },
    [stopWaiting],
  );

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
            if (!cur || c.id === cur.id) onConv(c);
            break;
          }
        }
      }),
    [take, onConv],
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
      r.data.messages.forEach(take);
      onConv(r.data.conversation);
      const elapsed = Date.now() - since.current;
      if (elapsed > SLOW_MS) setSlow(true);
      if (elapsed > GIVE_UP_MS) stopWaiting();
    };
    const id = setInterval(() => void tick(), POLL_MS);
    return () => clearInterval(id);
  }, [waiting, take, onConv, stopWaiting]);

  /** Sends a question that's already shown as turn `tmp`; `toBot` false = it goes to the team's open request. */
  const send = React.useCallback(
    (text: string, tmp: string, toBot: boolean) => {
      setSending(true);
      setSlow(false);
      setWaiting(toBot);
      setStreaming(toBot ? "" : null);
      void api<{ conversation: Conversation; message: Message }>("messages", { body: text }).then((r) => {
        setSending(false);
        if (!r.ok || !r.data.message) {
          setTurns((ts) => ts.filter((x) => x.id !== tmp));
          stopWaiting();
          setError(r.status === 0 ? unavailable : errMsg(r.data, unavailable));
          return;
        }
        lastAsked.current = r.data.message.id;
        setConv(r.data.conversation);
        setTurns((ts) => ts.map((x) => (x.id === tmp ? { ...x, id: String(r.data.message.id) } : x)));
        // the bot answers only conversations it owns; anything else is with the team
        if (r.data.conversation.status !== "bot") {
          stopWaiting();
          if (!toBot) setSentToTeam(true);
        }
      });
    },
    [stopWaiting, unavailable],
  );

  const ask = React.useCallback(
    (raw: string, chip?: string) => {
      const text = raw.trim();
      if (!text || sending || held) return;
      const tmp = `tmp-${Date.now()}`;
      setError(null);
      setTurns((ts) => [...ts, { id: tmp, role: "you", text, chip }]);
      // a request for a person is open: the bot would never answer there, so the client chooses first
      if (askRoute(convRef.current?.status) === "person") return setHeld({ id: tmp, text });
      send(text, tmp, true);
    },
    [sending, held, send],
  );

  const closeAndAsk = React.useCallback(() => {
    const h = held;
    const cur = convRef.current;
    if (!h) return;
    setHeld(null);
    setError(null);
    if (!cur || !withPerson(cur.status)) return send(h.text, h.id, true);
    setSending(true);
    void api<{ conversation: Conversation }>(`conversations/${cur.id}/resolve`, {}).then((r) => {
      setSending(false);
      if (!r.ok) {
        setHeld(h);
        return setError(errMsg(r.data, unavailable));
      }
      // the request is closed; the question opens a new conversation that the bot owns
      setConv(r.data.conversation);
      convRef.current = r.data.conversation;
      send(h.text, h.id, true);
    });
  }, [held, send, unavailable]);

  const sendToTeam = React.useCallback(() => {
    const h = held;
    if (!h) return;
    setHeld(null);
    setError(null);
    send(h.text, h.id, false);
  }, [held, send]);

  const handover = React.useCallback(() => {
    setError(null);
    void api<{ conversation: Conversation }>("handover", {}).then((r) => {
      if (!r.ok) return setError(errMsg(r.data, unavailable));
      setConv(r.data.conversation);
      stopWaiting();
    });
  }, [unavailable, stopWaiting]);

  const reset = React.useCallback(() => {
    setTurns([]);
    setHeld(null);
    setSentToTeam(false);
    stopWaiting();
    setError(null);
  }, [stopWaiting]);

  const status = conv?.status ?? null;
  const has = turns.length > 0;
  return {
    botName,
    turns,
    streaming,
    waiting,
    slow,
    sending,
    error,
    status,
    agentName: conv?.assigneeName ?? null,
    openRequest: withPerson(status) && (!has || !!held),
    blocked: !!held,
    withTeam: has && !held && (sentToTeam || withPerson(status)),
    ask,
    closeAndAsk,
    sendToTeam,
    handover,
    reset,
  };
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
    openRequest: false,
    blocked: false,
    withTeam: turns.length > 0 && (status === "waiting" || status === "assigned"),
    closeAndAsk: () => {},
    sendToTeam: () => {},
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
