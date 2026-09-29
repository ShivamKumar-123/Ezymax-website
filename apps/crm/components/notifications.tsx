"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast, useSonner } from "sonner";
import { ArrowDownToLine, Bell, CandlestickChart, CheckCircle2, Coins, IdCard, Info, LifeBuoy, Megaphone, ShieldCheck, Trophy, TriangleAlert, Users, Wallet, XCircle } from "lucide-react";
import { EmptyState, IconButton, Popover, cn } from "@kalks/ui";
import { IS_DEMO, NOTIFICATIONS } from "@kalks/mock";
import { realtime, type Frame } from "@/lib/realtime";

/* ------------------------------------------------------------------ */
/* In-app event log: every toast is kept as a notification             */
/* ------------------------------------------------------------------ */

type Kind = "success" | "error" | "warning" | "info" | "default";
export type LoggedEvent = { id: string; kind: Kind; title: string; description?: string; at: number; unread: boolean };

const CAP = 100;
const EMPTY: LoggedEvent[] = [];
let storeKey = "";
let cache: LoggedEvent[] = EMPTY;
const listeners = new Set<() => void>();

function read(key: string): LoggedEvent[] {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as LoggedEvent[]) : [];
    return Array.isArray(v) ? v.slice(0, CAP) : [];
  } catch {
    return [];
  }
}

function write(next: LoggedEvent[]) {
  cache = next.slice(0, CAP);
  try {
    window.localStorage.setItem(storeKey, JSON.stringify(cache));
  } catch {
    /* private mode / storage full: keep the in-memory log */
  }
  listeners.forEach((l) => l());
}

/** Per-browser, per-client log (so two clients sharing a browser never see each other's events). */
function useEventLog(userKey: string): LoggedEvent[] {
  const key = `kalks.crm.notifications.${userKey}`;
  if (typeof window !== "undefined" && storeKey !== key) {
    storeKey = key;
    cache = read(key);
  }
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storeKey) return;
      cache = read(storeKey);
      listeners.forEach((l) => l());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cache,
    () => EMPTY,
  );
}

function text(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "function") return text((node as () => unknown)());
  return "";
}

/** Records every toast shown in the Client Area (sonner's active list) into the event log. */
function ToastRecorder() {
  const { toasts } = useSonner();
  const seen = React.useRef(new Set<string | number>());
  React.useEffect(() => {
    const fresh: LoggedEvent[] = [];
    for (const t of toasts) {
      if (seen.current.has(t.id)) continue;
      seen.current.add(t.id);
      // live notifications from the service are already in the bell
      if (typeof t.id === "string" && t.id.startsWith("srv-")) continue;
      if (t.type === "loading") continue;
      const title = text(t.title);
      if (!title) continue;
      const kind: Kind = t.type === "success" || t.type === "error" || t.type === "warning" || t.type === "info" ? t.type : "default";
      fresh.push({ id: `${Date.now()}-${t.id}`, kind, title, description: text(t.description) || undefined, at: Date.now(), unread: true });
    }
    if (fresh.length) write([...fresh.reverse(), ...cache]);
  }, [toasts]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Service notifications (services/support via /api/notifications)     */
/* ------------------------------------------------------------------ */

export type ServerItem = {
  id: number;
  type: string;
  category: string;
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

async function call<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(`/api/notifications${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Live inbox from the notification service: first page + realtime pushes. */
function useServerNotifications(enabled: boolean) {
  const [items, setItems] = React.useState<ServerItem[]>([]);
  const [unread, setUnread] = React.useState(0);
  const load = React.useCallback(async () => {
    const d = await call<{ items: ServerItem[]; unread: number }>("?limit=40");
    if (d) {
      setItems(d.items);
      setUnread(d.unread);
    }
  }, []);
  React.useEffect(() => {
    if (!enabled) return;
    void load();
    return realtime().subscribe((f: Frame) => {
      if (f.type === "reconnected") return void load();
      if (f.type === "hello") return setUnread(Number(f.unread ?? 0));
      if (f.type === "notification") {
        const it = f.item as ServerItem;
        setItems((xs) => (xs.some((x) => x.id === it.id) ? xs : [it, ...xs].slice(0, 100)));
        setUnread(Number(f.unread ?? 0));
        // a reply in the chat you're looking at needs no toast
        if (it.type === "support.reply" && window.location.pathname.startsWith("/support")) return;
        const fn = it.severity === "critical" || it.severity === "warning" ? toast.warning : it.severity === "success" ? toast.success : toast.info;
        fn(it.title, { id: `srv-${it.id}`, description: it.body || undefined });
      }
      if (f.type === "notifications.read") {
        setUnread(Number(f.unread ?? 0));
        if (f.cleared) setItems([]);
        else if (f.all) setItems((xs) => xs.map((x) => ({ ...x, read: true })));
        else {
          const ids = new Set((f.ids as number[]) ?? []);
          setItems((xs) => xs.map((x) => (ids.has(x.id) ? { ...x, read: true } : x)));
        }
      }
    });
  }, [enabled, load]);
  return {
    items,
    unread,
    markAll: () => {
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
      setUnread(0);
      void call("/read", { all: true });
    },
    markOne: (id: number) => {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
      setUnread((n) => Math.max(0, n - 1));
      void call("/read", { ids: [id] });
    },
    clear: () => {
      setItems([]);
      setUnread(0);
      void call("/clear", {});
    },
  };
}

/* ------------------------------------------------------------------ */
/* Bell                                                                */
/* ------------------------------------------------------------------ */

const KIND_ICON: Record<Kind, { icon: React.ReactNode; cls: string }> = {
  success: { icon: <CheckCircle2 />, cls: "text-up" },
  error: { icon: <XCircle />, cls: "text-down" },
  warning: { icon: <TriangleAlert />, cls: "text-warn" },
  info: { icon: <Info />, cls: "text-info" },
  default: { icon: <Bell />, cls: "text-fg-2" },
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  security: <ShieldCheck />,
  trading_alerts: <TriangleAlert />,
  trading_fills: <CandlestickChart />,
  wallet: <Wallet />,
  kyc: <IdCard />,
  ib: <Coins />,
  copy: <Users />,
  prop: <Trophy />,
  support: <LifeBuoy />,
  marketing: <Megaphone />,
  system: <Bell />,
};

const SEVERITY_CLS: Record<ServerItem["severity"], string> = { info: "text-info", success: "text-up", warning: "text-warn", critical: "text-down" };

const MOCK_ICON: Record<string, React.ReactNode> = {
  fill: <CheckCircle2 />,
  deposit: <ArrowDownToLine />,
  kyc: <IdCard />,
  ib: <Coins />,
  margin: <TriangleAlert />,
};

function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Row = { id: string; title: string; description?: string; at: number; time: string; unread: boolean; icon: React.ReactNode; iconCls: string; onOpen?: () => void };

/**
 * Topbar notifications: the client's notifications from the notification service (deposits, withdrawals,
 * verification, margin calls, support replies, announcements; live over the realtime stream) together with
 * every toast shown in this browser (kept locally as history). Demo builds list the sample notifications.
 */
export function NotificationsBell({ userKey }: { userKey: string }) {
  const router = useRouter();
  const log = useEventLog(userKey);
  const srv = useServerNotifications(!IS_DEMO);
  const [mock, setMock] = React.useState(() => (IS_DEMO ? NOTIFICATIONS.map((n) => ({ ...n })) : []));
  const [now, setNow] = React.useState(0);

  const rows: Row[] = [
    ...srv.items.map((n) => {
      const at = new Date(n.createdAt).getTime();
      return {
        id: `srv-${n.id}`,
        title: n.title,
        description: n.body || undefined,
        at,
        time: now ? ago(at, now) : "",
        unread: !n.read,
        icon: CATEGORY_ICON[n.category] ?? <Bell />,
        iconCls: SEVERITY_CLS[n.severity] ?? "text-fg-2",
        onOpen: () => {
          if (!n.read) srv.markOne(n.id);
          if (n.link?.startsWith("/")) router.push(n.link);
          else if (n.link) window.open(n.link, "_blank", "noopener");
        },
      };
    }),
    ...log.map((e) => ({ id: e.id, title: e.title, description: e.description, at: e.at, time: now ? ago(e.at, now) : "", unread: e.unread, icon: KIND_ICON[e.kind].icon, iconCls: KIND_ICON[e.kind].cls })),
  ].sort((a, b) => b.at - a.at);
  const mockRows: Row[] = mock.map((n) => ({ id: `mock-${n.id}`, title: n.title, at: 0, time: `${n.time} ago`, unread: n.unread, icon: MOCK_ICON[n.kind] ?? <Bell />, iconCls: "text-fg-2" }));
  const all = [...rows, ...mockRows];
  const unread = srv.unread + log.filter((e) => e.unread).length + mock.filter((m) => m.unread).length;

  const markAll = () => {
    if (log.some((e) => e.unread)) write(log.map((e) => ({ ...e, unread: false })));
    if (srv.unread > 0) srv.markAll();
    setMock((m) => m.map((n) => ({ ...n, unread: false })));
  };
  const clear = () => {
    write([]);
    if (srv.items.length) srv.clear();
    setMock([]);
  };

  return (
    <>
      <ToastRecorder />
      <Popover
        width={380}
        trigger={
          <IconButton aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} data-testid="notifications-bell" onPointerDown={() => setNow(Date.now())} onKeyDown={() => setNow(Date.now())}>
            <Bell />
            {unread > 0 && (
              <span data-testid="notifications-unread" className="k-num pointer-events-none absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-bg">
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
          {all.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <button onClick={markAll} disabled={!unread} className="text-fg-3 hover:text-fg disabled:opacity-40 disabled:hover:text-fg-3">
                Mark all read
              </button>
              <button onClick={clear} className="text-fg-3 hover:text-down">
                Clear
              </button>
            </div>
          )}
        </div>
        {all.length === 0 ? (
          <EmptyState illustration="bell" title="No notifications yet" text="Deposits, withdrawals, verification, trading alerts and replies from support appear here." className="py-10" />
        ) : (
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5" data-testid="notifications-list">
            {all.map((n) => {
              const inner = (
                <>
                  <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 [&_svg]:size-4", n.iconCls)}>{n.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] leading-snug", n.unread ? "text-fg" : "text-fg-2")}>{n.title}</p>
                    {n.description && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-3">{n.description}</p>}
                    {n.time && <p className="mt-0.5 text-[11.5px] text-fg-3">{n.time}</p>}
                  </div>
                  {n.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-ember" />}
                </>
              );
              return n.onOpen ? (
                <button key={n.id} onClick={n.onOpen} className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-3">
                  {inner}
                </button>
              ) : (
                <div key={n.id} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-3">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
        <div className="border-t border-line px-4 py-2.5 text-right text-xs">
          <a href="/profile/notifications" className="text-fg-3 hover:text-fg">
            Notification settings
          </a>
        </div>
      </Popover>
    </>
  );
}
