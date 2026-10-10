"use client";

// The set-up prompts on the dashboard: verification / funding tasks with inline actions (filled + "Later").
// Notifications themselves are not here — they live in the bell in the top bar, and only there, so the
// dashboard is not a second copy of the inbox.

import * as React from "react";
import Link from "next/link";
import { Button, IconTile, type TileTone } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";

export type Prompt = { id: string; title: string; text: string; icon: React.ReactNode; tone: TileTone; action: { label: string; href: string }; time?: string };

const LATER_KEY = "ezymex.crm.prompts.later";

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

/** `limit` is kept for the callers that pass it; the inbox it used to cap now lives in the bell. */
export function NotificationsPanel({ prompts = [] }: { prompts?: Prompt[]; limit?: number }) {
  const t = useT();
  const [later, addLater] = useLater();
  const shown = prompts.filter((p) => !later.includes(p.id));
  // nothing to do means no section, rather than an empty card
  if (shown.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="k-display text-[17px] font-semibold tracking-[-0.01em]">{t("dashboard.home.setUpTitle")}</h3>
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
      </div>
    </section>
  );
}
