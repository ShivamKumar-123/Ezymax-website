// Support chat state: the chat home (settings, the open or just-ended conversation and its messages) is a
// persisted query, so /support opens at once on the last conversation; the realtime stream and every action
// update it with the server's answers. The bot's streamed answer and "agent is typing" are separate small stores:
// a streamed word re-renders only the streaming bubble, never the message list.
import * as React from "react";
import { i18n } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { getQueryData, invalidate, setQueryData } from "@/lib/query";
import { createStore } from "@/lib/store";
import { onSignOut } from "@/session";
import { HISTORY_KEY, HOME_KEY, postHandover, postMessage, postRate, postRead, postResolve, postTyping, transcriptKey, type Conversation, type Home, type Message } from "./api";
import { answeredAfter, mergeConversation } from "./merge";
import { supportStream, type Frame } from "./stream";

/** The bot's answer while it streams (`id` "pending" until the first frame names it). */
export const botStream = createStore<{ id: string; conversationId: number | null; text: string } | null>(null);
/** An agent typing in this conversation (cleared 4 s after the last signal, or by their message). */
export const agentTyping = createStore<number | null>(null);

let typingTimer: ReturnType<typeof setTimeout> | null = null;
let streamTimer: ReturnType<typeof setTimeout> | null = null;
let deltaBuf = "";
let deltaFor: { id: string; conversationId: number | null } | null = null;
let deltaRaf: number | null = null;

const home = () => getQueryData<Home>(HOME_KEY);

function insert(messages: Message[], m: Message): Message[] {
  if (messages.some((x) => x.id === m.id)) return messages;
  const out = [...messages, m];
  if (out.length > 1 && out[out.length - 2]!.id > m.id) out.sort((a, b) => a.id - b.id);
  return out;
}

function setHome(fn: (h: Home) => Home) {
  const h = home();
  if (h) setQueryData<Home>(HOME_KEY, fn(h), true);
}

/** A bot answer that stops arriving (the bot failed, a frame was lost) never leaves a bubble hanging: after 45 s
 *  without a word the bubble goes and the chat reloads from the server. */
function armStream() {
  if (streamTimer) clearTimeout(streamTimer);
  streamTimer = setTimeout(() => {
    streamTimer = null;
    if (!botStream.get()) return;
    deltaBuf = "";
    deltaFor = null;
    botStream.set(null);
    invalidate(HOME_KEY);
  }, 45_000);
}
function endStream() {
  if (streamTimer) clearTimeout(streamTimer);
  streamTimer = null;
  deltaBuf = "";
  deltaFor = null;
  botStream.set(null);
}

/** Deltas arrive word by word: they are joined and shown once per frame. */
function flushDelta() {
  deltaRaf = null;
  if (!deltaFor || !deltaBuf) return;
  const add = deltaBuf;
  const target = deltaFor;
  deltaBuf = "";
  armStream();
  botStream.set((s) => (s && s.id === target.id ? { ...s, text: s.text + add } : { id: target.id, conversationId: target.conversationId, text: (s?.id === "pending" ? s.text : "") + add }));
}

export function onFrame(f: Frame) {
  const h = home();
  const cur = h?.conversation ?? null;
  switch (f.type) {
    case "reconnected":
      invalidate(HOME_KEY);
      invalidate(HISTORY_KEY);
      return;
    case "message": {
      const m = f.message as Message;
      // a transcript open for that conversation follows too
      const tk = transcriptKey(m.conversationId);
      const tr = getQueryData<{ conversation: Conversation; messages: Message[] }>(tk);
      if (tr) setQueryData(tk, { ...tr, messages: insert(tr.messages, m) });
      if (!h) return;
      if (!cur || m.conversationId !== cur.id) {
        // a conversation this screen doesn't know yet (started on another device): reload
        invalidate(HOME_KEY);
        return;
      }
      setHome((x) => ({ ...x, messages: insert(x.messages, m) }));
      if (m.author === "bot") endStream();
      if (m.author === "agent") agentTyping.set(null);
      return;
    }
    case "conversation": {
      const c = f.conversation as Conversation;
      if (h && (!cur || c.id === cur.id)) setHome((x) => ({ ...x, conversation: c }));
      if (c.status !== "bot") endStream();
      invalidate(HISTORY_KEY);
      return;
    }
    case "bot.typing": {
      if (cur && f.conversationId !== cur.id) return;
      deltaFor = { id: String(f.streamId), conversationId: Number(f.conversationId) };
      botStream.set({ id: String(f.streamId), conversationId: Number(f.conversationId), text: "" });
      armStream();
      return;
    }
    case "bot.delta": {
      if (cur && f.conversationId !== cur.id) return;
      const id = String(f.streamId);
      if (!deltaFor || deltaFor.id !== id) {
        deltaFor = { id, conversationId: Number(f.conversationId) };
        deltaBuf = "";
      }
      deltaBuf += String(f.text ?? "");
      if (deltaRaf === null) deltaRaf = requestAnimationFrame(flushDelta);
      return;
    }
    case "typing": {
      if (f.from !== "agent" || (cur && f.conversationId !== cur.id)) return;
      agentTyping.set(Number(f.conversationId));
      if (typingTimer) clearTimeout(typingTimer);
      typingTimer = setTimeout(() => agentTyping.set(null), 4000);
      return;
    }
  }
}

/** Mounted by the chat screens: keeps the realtime stream open while they are on screen. */
export function useSupportStream() {
  React.useEffect(() => supportStream.subscribe(onFrame), []);
}

/* ---- actions (never optimistic: the screen shows the server's answer) ---- */

export type Result = { ok: true } | { ok: false; error: string };
const fail = (e: ApiError): Result => ({ ok: false, error: e.message || i18n.t("common.errorRetry") });

export async function send(body: string, attachmentId?: number): Promise<Result> {
  const r = await postMessage(body, attachmentId);
  if (!r.ok) return fail(r.error);
  const { message } = r.data;
  // the stream may already have delivered a later state (the bot answered, or handed the chat over)
  const conversation = mergeConversation(home()?.conversation, r.data.conversation);
  setHome((x) => ({ ...x, conversation, messages: x.conversation?.id === conversation.id ? insert(x.messages, message) : [message] }));
  // the bot answers over the stream: show its bubble at once, unless its answer already arrived
  if (conversation.status === "bot" && !answeredAfter(home()?.messages ?? [], message.id)) {
    botStream.set((s) => s ?? { id: "pending", conversationId: conversation.id, text: "" });
    armStream();
  }
  invalidate(HISTORY_KEY);
  return { ok: true };
}

export async function handover(): Promise<Result> {
  const r = await postHandover();
  if (!r.ok) return fail(r.error);
  const had = home()?.conversation?.id;
  setHome((x) => ({ ...x, conversation: mergeConversation(x.conversation, r.data.conversation) }));
  // a chat opened straight into the queue: load its first messages
  if (had !== r.data.conversation.id) invalidate(HOME_KEY);
  endStream();
  return { ok: true };
}

export async function endChat(id: number): Promise<Result> {
  const r = await postResolve(id);
  if (!r.ok) return fail(r.error);
  setHome((x) => ({ ...x, conversation: r.data.conversation }));
  endStream();
  invalidate(HISTORY_KEY);
  return { ok: true };
}

export async function rate(id: number, rating: number, comment: string): Promise<Result> {
  const r = await postRate(id, rating, comment);
  if (!r.ok) return fail(r.error);
  setHome((x) => ({ ...x, conversation: r.data.conversation }));
  invalidate(HISTORY_KEY);
  return { ok: true };
}

/** After an ended chat: a clean page (the next message opens a new conversation on the server). */
export function startNew() {
  setHome((x) => ({ ...x, conversation: null, messages: [] }));
  endStream();
}

export async function markRead() {
  const r = await postRead();
  if (r.ok) setHome((x) => (x.conversation ? { ...x, conversation: { ...x.conversation, clientUnread: 0 } } : x));
}

let lastTyping = 0;
/** "Client is typing" for the agent, at most every 3 s, only while a person is in the chat. */
export function typing() {
  const c = home()?.conversation;
  if (!c || (c.status !== "waiting" && c.status !== "assigned")) return;
  if (Date.now() - lastTyping < 3000) return;
  lastTyping = Date.now();
  void postTyping();
}

onSignOut(() => {
  endStream();
  agentTyping.set(null);
});
