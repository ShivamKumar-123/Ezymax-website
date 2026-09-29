"use client";

import * as React from "react";
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@kalks/ui";
import { DropMenu } from "@/components/ui/menu";
import { notifications, useNotifications, type Note } from "@/lib/notify";
import { serverTime } from "@/lib/trading";
import { BellTabs, useAccountBell } from "./account-notifications";

const ICON: Record<Note["kind"], React.ReactNode> = {
  success: <CircleCheck className="text-up" />,
  error: <CircleAlert className="text-down" />,
  warning: <TriangleAlert className="text-warn" />,
  info: <Info className="text-fg-3" />,
};

function when(ts: number) {
  const s = serverTime(new Date(ts));
  const today = serverTime().date === s.date;
  return today ? s.time : `${s.date.slice(5)} ${s.time.slice(0, 5)}`;
}

/** Title-bar bell: account notifications (support inbox) and this browser's toast history, unread badge. */
export function NotificationBell({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const list = useNotifications();
  const local = list.filter((n) => !n.read).length;
  const { inbox, enabled } = useAccountBell();
  const unread = local + (enabled ? inbox.unread : 0);
  return (
    <DropMenu
      align="end"
      width={360}
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          className={cn("relative grid place-items-center rounded-[7px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg", size === "md" ? "size-8" : "size-9", open && "bg-surface-3 text-fg", className)}
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          title="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 && <span className="k-num absolute right-0.5 top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-ember px-[3px] font-mono text-[9px] font-semibold leading-none text-white">{unread > 99 ? "99+" : unread}</span>}
        </button>
      )}
    >
      {() => <BellTabs inbox={inbox} enabled={enabled} terminalUnread={local} terminal={<Panel list={list} unread={local} />} />}
    </DropMenu>
  );
}

function Panel({ list, unread }: { list: Note[]; unread: number }) {
  return (
    <div className="flex max-h-[min(520px,calc(100dvh-80px))] flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-2">Notifications</span>
        {unread > 0 && <span className="k-num rounded-[4px] bg-ember-soft px-1 font-mono text-[10px] text-ember">{unread} new</span>}
        <span className="ml-auto flex items-center gap-0.5">
          <button onClick={notifications.markAllRead} disabled={!unread} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-40">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
          <button onClick={notifications.clear} disabled={!list.length} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-down disabled:pointer-events-none disabled:opacity-40">
            <Trash2 className="size-3.5" /> Clear
          </button>
        </span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto py-1">
        {list.map((n) => (
          <button
            key={n.id}
            onClick={() => notifications.markRead(n.id)}
            className={cn("flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-3/60", !n.read && "bg-ember-soft/25")}
          >
            <span className="mt-px shrink-0 [&>svg]:size-3.5">{ICON[n.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[12px] leading-[16px]", n.read ? "text-fg-2" : "font-medium text-fg")}>{n.title}</span>
              {n.text && <span className="mt-0.5 block truncate font-mono text-[10.5px] text-fg-3">{n.text}</span>}
            </span>
            <span className="k-num shrink-0 pt-px font-mono text-[10px] text-fg-3">{when(n.ts)}</span>
            {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ember" aria-label="Unread" />}
          </button>
        ))}
        {!list.length && (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto mb-2 size-4 text-fg-3" />
            <div className="text-[12px] text-fg-2">No notifications</div>
            <div className="mt-0.5 text-[11px] text-fg-3">Confirmations, alerts and errors are kept here.</div>
          </div>
        )}
      </div>
    </div>
  );
}
