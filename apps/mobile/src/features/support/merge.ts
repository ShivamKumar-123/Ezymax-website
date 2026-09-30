// Pure helpers of the support chat state (no React Native: tested in scripts/ai-lib.test.mts).
// The realtime stream and the HTTP answers race: the bot can answer, or hand the chat over, before the answer to the
// message that triggered it arrives. The chat keeps the later state.
import type { Conversation, Message } from "./api";

/** A conversation only moves forward: bot → queue → agent → ended (a reopened chat comes over the stream). */
const STAGE: Record<Conversation["status"], number> = { bot: 0, waiting: 1, assigned: 2, resolved: 3 };

/** The conversation an HTTP answer carries, unless the stream already delivered a later state of the same one. */
export function mergeConversation(cur: Conversation | null | undefined, next: Conversation): Conversation {
  return cur && cur.id === next.id && (STAGE[cur.status] ?? 0) > (STAGE[next.status] ?? 0) ? cur : next;
}

/** Someone (the bot, an agent, the system) already answered after the client's message `id`. */
export function answeredAfter(messages: Message[], id: number): boolean {
  return messages.some((m) => m.author !== "client" && m.id > id);
}
