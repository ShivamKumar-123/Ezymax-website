// The notifications inbox on the Client Area BFF (/api/mobile/notifications -> /api/notifications -> services/support
// /v1/notifications/me): pages newest first (`before` = id cursor), read / read all. The same inbox as the Client
// Area bell, so reading on one reads on the other.
//
// The unread count lives in one place for the app: the Home bell's query ("home/bell", src/features/home) holds
// `{unread}`; every answer here writes it, so the badge follows without another request. The app icon badge follows
// too (push/index.ts).
import { apiGet, apiPost } from "@/lib/api";
import { getQueryData, setQueryData } from "@/lib/query";
import { setBadge } from "../push";

export type Severity = "info" | "success" | "warning" | "critical";

export type NotificationItem = {
  id: number;
  type: string;
  /** preference topic: security, trading_alerts, trading_fills, wallet, kyc, ib, copy, prop, support, system, marketing */
  category: string;
  severity: Severity;
  title: string;
  body: string;
  /** app path (/wallet/history) or https:// URL */
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

export type InboxPage = { items: NotificationItem[]; unread: number; next: number | null };
export type InboxFilter = "all" | "unread";

export const PAGE = 30;

export const QK = {
  inbox: (f: InboxFilter) => `platform:inbox:${f}`,
  /** Home's bell (src/features/home/HomeScreen.tsx) */
  bell: "home/bell",
} as const;

export const fetchInbox = (filter: InboxFilter, before?: number | null) =>
  apiGet<InboxPage>(`notifications?limit=${PAGE}${filter === "unread" ? "&unread=true" : ""}${before ? `&before=${before}` : ""}`);

export const markRead = (ids: number[]) => apiPost<{ unread: number }>("notifications/read", { ids });
export const markAllRead = () => apiPost<{ unread: number }>("notifications/read", { all: true });

const FILTERS = ["all", "unread"] as const;

/** Publishes the unread count the server just gave: the inbox header, Home's bell and the app icon badge. */
export function setUnread(unread: number) {
  const n = Math.max(0, Math.floor(unread));
  const prev = getQueryData<{ unread?: number }>(QK.bell);
  if (prev?.unread !== n) setQueryData<{ unread: number }>(QK.bell, (p) => ({ ...(p ?? {}), unread: n }));
  for (const f of FILTERS) {
    const page = getQueryData<InboxPage>(QK.inbox(f));
    if (page && page.unread !== n) setQueryData<InboxPage>(QK.inbox(f), { ...page, unread: n }, true);
  }
  setBadge(n);
}

/** The cached pages with `ids` marked read, and their unread count lowered, so a tap shows at once (the server's
 *  count follows with setUnread). */
export function markCachedRead(ids: number[] | "all") {
  for (const f of FILTERS) {
    const page = getQueryData<InboxPage>(QK.inbox(f));
    if (!page) continue;
    const hit = (n: NotificationItem) => ids === "all" || ids.includes(n.id);
    const newly = page.items.filter((n) => hit(n) && !n.read).length;
    if (!newly && ids !== "all") continue;
    setQueryData<InboxPage>(QK.inbox(f), { ...page, unread: ids === "all" ? 0 : Math.max(0, page.unread - newly), items: page.items.map((n) => (hit(n) ? { ...n, read: true } : n)) }, true);
  }
}

/** A notification that just arrived (the support stream's `notification` frame): on top of the cached pages. */
export function addCachedItem(item: NotificationItem, unread: number) {
  for (const f of FILTERS) {
    const page = getQueryData<InboxPage>(QK.inbox(f));
    if (!page || page.items.some((n) => n.id === item.id) || (f === "unread" && item.read)) continue;
    setQueryData<InboxPage>(QK.inbox(f), { ...page, items: [item, ...page.items] }, true);
  }
  setUnread(unread);
}
