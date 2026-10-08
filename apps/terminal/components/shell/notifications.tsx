"use client";

import * as React from "react";
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { DropMenu } from "@/components/ui/menu";
import { notifications, toast, useNotifications, type Note } from "@/lib/notify";
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
/**
 * Desktop toasts stack right under the bell (providers.tsx reads these variables): aligned to its right edge, just below
 * the top bar. Without a bell on screen (Full chart hides the bar) they fall back to the window's top-right corner.
 */
function useToastAnchor(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement.style;
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      root.setProperty("--t-toast-top", `${Math.round(r.bottom + 10)}px`);
      root.setProperty("--t-toast-right", `${Math.max(8, Math.round(window.innerWidth - r.right))}px`);
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      root.setProperty("--t-toast-top", "10px");
      root.setProperty("--t-toast-right", "10px");
    };
  }, [ref, enabled]);
}

export function NotificationBell({ className, size = "md", anchorToasts = false }: { className?: string; size?: "sm" | "md" | "lg"; /** desktop top bar: toasts appear under this bell */ anchorToasts?: boolean }) {
  const t = useT();
  const anchor = React.useRef<HTMLSpanElement>(null);
  useToastAnchor(anchor, anchorToasts);
  const list = useNotifications();
  const local = list.filter((n) => !n.read).length;
  const { inbox, enabled } = useAccountBell();
  const unread = local + (enabled ? inbox.unread : 0);
  return (
    <span ref={anchor} className="inline-flex">
    <DropMenu
      align="end"
      width={360}
      trigger={({ toggle, open }) => (
        <button
          onClick={(e) => {
            // the toasts on screen are listed in the panel; left up they would cover it
            if (!open) toast.dismiss();
            toggle(e);
          }}
          className={cn("relative grid place-items-center text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg", size === "md" ? "size-8 rounded-[7px]" : "size-9 rounded-[8px]", open && "bg-surface-3 text-fg", className)}
          aria-label={unread ? t("trader.notifications.ariaUnread", { count: unread }) : t("trader.notifications.title")}
          title={t("trader.notifications.title")}
        >
          <Bell className={size === "lg" ? "size-[18px]" : "size-4"} />
          {unread > 0 && <span className="k-num absolute end-0.5 top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-ember px-[3px] font-mono text-[9px] font-semibold leading-none text-white">{unread > 99 ? "99+" : unread}</span>}
        </button>
      )}
    >
      {() => <BellTabs inbox={inbox} enabled={enabled} terminalUnread={local} terminal={<Panel list={list} unread={local} />} />}
    </DropMenu>
    </span>
  );
}

function Panel({ list, unread }: { list: Note[]; unread: number }) {
  const t = useT();
  return (
    <div className="flex max-h-[min(520px,calc(100dvh-80px))] flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-2">{t("trader.notifications.title")}</span>
        {unread > 0 && <span className="k-num rounded-[4px] bg-ember-soft px-1 font-mono text-[10px] text-ember">{t("trader.notifications.new", { count: unread })}</span>}
        <span className="ms-auto flex items-center gap-0.5">
          <button onClick={notifications.markAllRead} disabled={!unread} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-40">
            <CheckCheck className="size-3.5" /> {t("trader.notifications.markAllRead")}
          </button>
          <button onClick={notifications.clear} disabled={!list.length} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-2 hover:bg-surface-3 hover:text-down disabled:pointer-events-none disabled:opacity-40">
            <Trash2 className="size-3.5" /> {t("trader.notifications.clear")}
          </button>
        </span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto py-1">
        {list.map((n) => (
          <button
            key={n.id}
            onClick={() => notifications.markRead(n.id)}
            className={cn("flex w-full items-start gap-2.5 px-3 py-2 text-start transition-colors hover:bg-surface-3/60", !n.read && "bg-ember-soft/25")}
          >
            <span className="mt-px shrink-0 [&>svg]:size-3.5">{ICON[n.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[12px] leading-[16px]", n.read ? "text-fg-2" : "font-medium text-fg")}>{n.title}</span>
              {n.text && <span className="mt-0.5 block truncate font-mono text-[10.5px] text-fg-3">{n.text}</span>}
            </span>
            <span className="k-num shrink-0 pt-px font-mono text-[10px] text-fg-3">{when(n.ts)}</span>
            {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ember" aria-label={t("trader.notifications.unread")} />}
          </button>
        ))}
        {!list.length && (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto mb-2 size-4 text-fg-3" />
            <div className="text-[12px] text-fg-2">{t("trader.notifications.empty")}</div>
            <div className="mt-0.5 text-[11px] text-fg-3">{t("trader.notifications.emptyHint")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
