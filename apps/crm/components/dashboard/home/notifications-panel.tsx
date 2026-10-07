"use client";

// Notifications on the dashboard: verification / funding prompts with inline actions (filled + "Later"), then the
// client's latest notifications (the same inbox as the top bar's bell), each with a pastel icon tile and its time.

import * as React from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { Button, IconTile, cn, type TileTone } from "@/components/kit";
import { useNotifications } from "@/components/notifications";
import { useT } from "@kalks/i18n/react";

export type Prompt = { id: string; title: string; text: string; icon: React.ReactNode; tone: TileTone; action: { label: string; href: string }; time?: string };

const LATER_KEY = "kalks.crm.prompts.later";

function useLater() {
  const [later, setLater] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      setLater(JSON.parse(window.sessionStorage.getItem(LATER_KEY) ?? "[]") as string[]);
    } catch {
      /* storage blocked */
    }
  }, []);
  const add = (id: string) =>
    setLater((l) => {
      const next = [...l, id];
      try {
        window.sessionStorage.setItem(LATER_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return [later, add] as const;
}

export function NotificationsPanel({ prompts = [], limit = 4 }: { prompts?: Prompt[]; limit?: number }) {
  const t = useT();
  const n = useNotifications();
  const [later, addLater] = useLater();
  const shown = prompts.filter((p) => !later.includes(p.id));
  const rows = n.rows.slice(0, Math.max(1, limit - shown.length));
  const dot = n.unread > 0 || shown.length > 0;
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="k-display flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em]">
          {t("dashboard.notifications.title")}
          {dot && <span className="size-2 rounded-full bg-down" aria-hidden />}
        </h3>
        <div className="flex items-center gap-1">
          {n.unread > 0 && (
            <button type="button" onClick={n.markAll} className="h-10 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 hover:text-fg">
              {t("dashboard.notifications.markAll")}
            </button>
          )}
          <Link href="/profile/notifications" aria-label={t("dashboard.notifications.settings")} className="grid size-10 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg">
            <Settings className="size-[18px]" />
          </Link>
        </div>
      </div>
      <div className="mt-2 divide-y divide-line">
        {shown.map((p) => (
          <div key={p.id} className="flex gap-3.5 py-4">
            <IconTile tone={p.tone} size={46} className="[&_svg]:size-5">
              {p.icon}
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[14.5px] font-bold leading-snug text-fg">{p.title}</div>
                {p.time && <span className="shrink-0 pt-0.5 text-[12px] text-fg-3">{p.time}</span>}
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-fg-3">{p.text}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={p.action.href} className="block">
                  <Button size="sm" variant="ember" className="w-full">
                    {p.action.label}
                  </Button>
                </Link>
                <Button size="sm" variant="outline" className="w-full" onClick={() => addLater(p.id)}>
                  {t("dashboard.home.later")}
                </Button>
              </div>
            </div>
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.id} className="flex gap-3.5 py-4">
            <IconTile tone={r.tone} size={46} className="[&_svg]:size-5">
              {r.icon}
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className={cn("line-clamp-2 text-[14px] leading-snug", r.unread ? "font-bold text-fg" : "font-semibold text-fg-2")}>{r.title}</div>
                {r.time && <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12px] text-fg-3">{r.time}</span>}
              </div>
              {r.description && <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-fg-3">{r.description}</p>}
              {r.onOpen && (
                <button type="button" onClick={r.onOpen} className="k-hit relative mt-1.5 text-[12.5px] font-semibold text-ember hover:underline">
                  {t("dashboard.home.viewDetails")}
                </button>
              )}
            </div>
          </div>
        ))}
        {shown.length === 0 && rows.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-[14px] font-semibold text-fg">{t("dashboard.notifications.emptyTitle")}</div>
            <div className="mt-1 text-[12.5px] text-fg-3">{t("dashboard.notifications.emptyText")}</div>
          </div>
        )}
      </div>
    </section>
  );
}
