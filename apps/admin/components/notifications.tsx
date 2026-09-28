"use client";

/**
 * Notification history for the Back Office: every toast shown (sonner) is also kept in the topbar bell,
 * newest first, per browser (localStorage, last 100). Live builds show only these real events; demo builds
 * also list a few sample alerts.
 */
import * as React from "react";
import { useSonner, type ToastT } from "sonner";
import { Bell, CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import { IconButton, Popover, cn, formatDateTime } from "@kalks/ui";
import { IS_DEMO } from "@kalks/mock/mode";

export type NoticeType = "success" | "error" | "warning" | "info" | "default";
export type Notice = { id: string; type: NoticeType; title: string; description?: string; at: number; read: boolean };

const KEY = "kalks_admin_notifications";
const CAP = 100;
const BOOT = Math.random().toString(36).slice(2, 8);

let cache: Notice[] | null = null;
const listeners = new Set<() => void>();

function load(): Notice[] {
  if (cache) return cache;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    const v = raw ? (JSON.parse(raw) as Notice[]) : [];
    cache = Array.isArray(v) ? v.slice(0, CAP) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(next: Notice[]) {
  cache = next.slice(0, CAP);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: keep in memory */
  }
  listeners.forEach((l) => l());
}

const EMPTY: Notice[] = [];
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useNotices(): Notice[] {
  return React.useSyncExternalStore(subscribe, load, () => EMPTY);
}

export const notices = {
  markAllRead: () => save(load().map((n) => ({ ...n, read: true }))),
  markRead: (id: string) => save(load().map((n) => (n.id === id ? { ...n, read: true } : n))),
  clear: () => save([]),
};

/** Plain text of a toast title / description (string, number, element tree or render function). */
function text(node: unknown, depth = 0): string {
  if (depth > 8 || node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "function") {
    try {
      return text((node as () => unknown)(), depth + 1);
    } catch {
      return "";
    }
  }
  if (Array.isArray(node)) return node.map((n) => text(n, depth + 1)).join("");
  if (React.isValidElement(node)) return text((node.props as { children?: unknown }).children, depth + 1);
  return "";
}

function kind(t: ToastT): NoticeType {
  return t.type === "success" || t.type === "error" || t.type === "warning" || t.type === "info" ? t.type : "default";
}

/** Mount once (root layout): records every toast into the history. */
export function NotificationRecorder() {
  const { toasts } = useSonner();
  React.useEffect(() => {
    if (!toasts.length) return;
    let list = load();
    let changed = false;
    for (const t of toasts) {
      if (t.type === "loading" || t.delete) continue;
      const title = text(t.title).trim();
      if (!title) continue;
      const description = text(t.description).trim() || undefined;
      const id = `${BOOT}:${t.id}`;
      const existing = list.find((n) => n.id === id);
      if (existing) {
        if (existing.title !== title || existing.description !== description || existing.type !== kind(t)) {
          list = list.map((n) => (n.id === id ? { ...n, title, description, type: kind(t) } : n));
          changed = true;
        }
        continue;
      }
      list = [{ id, type: kind(t), title, description, at: Date.now(), read: false }, ...list];
      changed = true;
    }
    if (changed) save(list);
  }, [toasts]);
  return null;
}

const ICON: Record<NoticeType, { icon: React.ReactNode; className: string }> = {
  success: { icon: <CheckCircle2 />, className: "bg-up-soft text-up" },
  error: { icon: <XCircle />, className: "bg-down-soft text-down" },
  warning: { icon: <TriangleAlert />, className: "bg-warn-soft text-warn" },
  info: { icon: <Info />, className: "bg-info-soft text-info" },
  default: { icon: <Bell />, className: "bg-surface-3 text-fg-2" },
};

/** Sample alerts for the demo showcase only. */
const DEMO_NOTICES: Notice[] = [
  { id: "demo-1", type: "warning", title: "USOIL feed stale for 4.2s, trading auto-paused", at: 0, read: false },
  { id: "demo-2", type: "warning", title: "Large withdrawal 48,000 USDT flagged for review", at: 0, read: false },
  { id: "demo-3", type: "info", title: "XAUUSD net exposure at 86% of limit", at: 0, read: false },
];

function relative(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const real = useNotices();
  const [demoRead, setDemoRead] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const demo = IS_DEMO ? DEMO_NOTICES.map((n, i) => ({ ...n, at: now - (i + 1) * 6 * 60_000, read: demoRead })) : [];
  const list = [...real, ...demo].sort((a, b) => b.at - a.at);
  const unread = list.filter((n) => !n.read).length;

  return (
    <Popover
      width={380}
      trigger={
        <IconButton aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && (
            <span className="k-num pointer-events-none absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember px-1 text-[10px] font-semibold text-white ring-2 ring-bg">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </IconButton>
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="text-sm font-medium">
          Notifications {unread > 0 && <span className="k-num ml-1 rounded-full bg-ember-soft px-1.5 text-[11px] text-ember">{unread}</span>}
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={!unread}
            onClick={() => {
              notices.markAllRead();
              setDemoRead(true);
            }}
            className="text-xs text-fg-3 hover:text-fg disabled:opacity-40 disabled:hover:text-fg-3"
          >
            Mark all read
          </button>
          <button disabled={!real.length} onClick={() => notices.clear()} className="text-xs text-fg-3 hover:text-down disabled:opacity-40 disabled:hover:text-fg-3">
            Clear
          </button>
        </div>
      </div>
      <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
        {list.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-surface-3 text-fg-3 [&_svg]:size-4">
              <Bell />
            </span>
            <p className="mt-3 text-[13px] font-medium">No notifications yet</p>
            <p className="mt-1 text-[12px] text-fg-3">Confirmations and alerts from your actions will be kept here.</p>
          </div>
        ) : (
          list.map((n) => (
            <button
              key={n.id}
              onClick={() => (n.id.startsWith("demo-") ? setDemoRead(true) : notices.markRead(n.id))}
              className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-3"
            >
              <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", ICON[n.type].className)}>{ICON[n.type].icon}</span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[13px] leading-snug", n.read ? "text-fg-2" : "text-fg")}>{n.title}</span>
                {n.description && <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{n.description}</span>}
                <span className="mt-1 block text-[11px] text-fg-3" title={formatDateTime(new Date(n.at).toISOString(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}>
                  {relative(n.at, now)}
                </span>
              </span>
              {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-ember" />}
            </button>
          ))
        )}
      </div>
    </Popover>
  );
}
