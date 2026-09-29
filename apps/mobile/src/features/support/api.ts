// Support chat's server calls: the support service through the Client Area BFF (/api/mobile/support/* rewrites to
// the /api/support/* routes the web chat uses; the client always comes from the session, never from the app).
// Shapes follow services/support/README.md ("Client"). Replies from the bot and agents arrive over the realtime
// stream (stream.ts); these calls return the server's state after each change.
import { apiGet, apiPost, apiUploadRaw } from "@/lib/api";
import { prefetch } from "@/lib/query";

export type ConvStatus = "bot" | "waiting" | "assigned" | "resolved";

export interface Conversation {
  id: number;
  subject: string;
  status: ConvStatus;
  assigneeName: string | null;
  handedOverAt: string | null;
  clientUnread: number;
  csat: { rating: number; comment: string | null } | null;
  resolvedAt: string | null;
  createdAt: string;
  lastMessageAt: string;
  preview: string;
}

export interface Attachment {
  id: number;
  name: string | null;
  mime: string | null;
  size: number | null;
}

export interface Message {
  id: number;
  conversationId: number;
  author: "client" | "bot" | "agent" | "system";
  authorName: string | null;
  body: string;
  attachment: Attachment | null;
  meta: { kind?: string; cites?: { slug: string; title: string }[]; rating?: number; agentName?: string; handover?: string | null };
  createdAt: string;
}

export interface Settings {
  botName: string;
  greeting: string;
  ai: boolean;
  autopilot?: boolean;
  agentsOnline: number;
  maxAttachmentMb: number;
}

export interface Home {
  settings: Settings;
  conversation: Conversation | null;
  messages: Message[];
}

export const HOME_KEY = "support/me";
export const HISTORY_KEY = "support/conversations";
export const transcriptKey = (id: number) => `support/conversations/${id}`;

export const fetchHome = () => apiGet<Home>("support/me");
export const fetchHistory = () => apiGet<{ items: Conversation[] }>("support/conversations");
export const fetchTranscript = (id: number) => apiGet<{ conversation: Conversation; messages: Message[] }>(`support/conversations/${id}`);

export const postMessage = (body: string, attachmentId?: number) => apiPost<{ conversation: Conversation; message: Message }>("support/messages", attachmentId ? { body, attachmentId } : { body });
export const postHandover = (reason?: string) => apiPost<{ conversation: Conversation }>("support/handover", reason ? { reason } : {});
export const postResolve = (id: number) => apiPost<{ conversation: Conversation }>(`support/conversations/${id}/resolve`, {});
export const postRate = (id: number, rating: number, comment: string) => apiPost<{ conversation: Conversation }>(`support/conversations/${id}/rate`, { rating, comment });
export const postRead = () => apiPost<{ status: string }>("support/read", {});
export const postTyping = () => apiPost<{ status: string }>("support/typing", {});
export const streamTicket = () => apiPost<{ ticket: string; url: string | null }>("support/stream-ticket", {}, { timeoutMs: 10_000 });

/** Warm /support before it opens (a menu row or a "Contact support" press-in): the last conversation. */
export function prefetchSupport() {
  prefetch(HOME_KEY, fetchHome, { persist: true, staleMs: 10_000 });
}

/** A file as the request body (images and PDF, sniffed again by the service), with upload progress. */
export const uploadAttachment = (file: Blob, name: string, type: string, onProgress?: (pct: number) => void) =>
  apiUploadRaw<{ attachment: Attachment }>("support/attachments", file, { contentType: type, headers: { "x-file-name": encodeURIComponent(name) }, onProgress, timeoutMs: 120_000 });
