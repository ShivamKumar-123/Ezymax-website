"use client";

// Two list blocks of the dashboard in the reference's row style (pastel icon tile, name, grey sub-text, a figure or
// status, and a pill action): the "Getting started" checklist card and the tabbed activity list.

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button, Card, Chip, IconTile, Progress, Tabs, cn, type ChipTone, type TileTone } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";

export type ListRowItem = {
  key: string;
  icon: React.ReactNode;
  tone: TileTone;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Amount or figure in the middle. */
  value?: React.ReactNode;
  /** Status pill on the right (soft tint, like "Connected"). */
  status?: { label: string; tone: ChipTone };
  /** Filled action on the right (like "Pay now" / "Connect"). */
  action?: { label: string; href: string; external?: boolean };
  done?: boolean;
  href?: string;
};

export function ItemRow({ r, compact }: { r: ListRowItem; compact?: boolean }) {
  const body = (
    <>
      <IconTile tone={r.done ? "mint" : r.tone} size={compact ? 42 : 48} className="[&_svg]:size-5">
        {r.done ? <Check strokeWidth={2.5} /> : r.icon}
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[14.5px] font-bold leading-snug", r.done ? "text-fg-2" : "text-fg")}>{r.title}</div>
        {r.sub && <div className="mt-0.5 truncate text-[12.5px] text-fg-3">{r.sub}</div>}
      </div>
      {r.value !== undefined && <div className="k-num k-display shrink-0 text-end text-[15px] font-bold text-fg">{r.value}</div>}
    </>
  );
  const end = r.action ? (
    r.action.external ? (
      <a href={r.action.href} target="_blank" rel="noopener" className="shrink-0">
        <Button size="sm" variant="ember" className="min-w-[88px]">
          {r.action.label}
        </Button>
      </a>
    ) : (
      <Link href={r.action.href} className="shrink-0">
        <Button size="sm" variant="ember" className="min-w-[88px]">
          {r.action.label}
        </Button>
      </Link>
    )
  ) : r.status ? (
    <Chip tone={r.status.tone} className="h-8 shrink-0 rounded-[11px] px-3 text-[12px]">
      {r.status.label}
    </Chip>
  ) : null;
  return (
    <div className="flex items-center gap-3.5 py-3">
      {r.href && !r.action ? (
        <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-ember/20">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3.5">{body}</div>
      )}
      {end}
    </div>
  );
}

export function ChecklistCard({ title, subtitle, rows, done, total, action, className }: { title: string; subtitle?: string; rows: ListRowItem[]; done: number; total: number; action?: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <Card className={cn("px-5 pb-3 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="k-display text-[18px] font-semibold tracking-[-0.015em]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-fg-3">{subtitle}</p>}
        </div>
        {action ?? (
          <div className="w-36 pt-1">
            <div className="mb-1.5 flex justify-between text-[11.5px] font-semibold text-fg-3">
              <span>{t("dashboard.steps.progress", { done, total })}</span>
              <span className="k-num">{Math.round((done / Math.max(1, total)) * 100)}%</span>
            </div>
            <Progress value={(done / Math.max(1, total)) * 100} />
          </div>
        )}
      </div>
      <div className="mt-2 divide-y divide-line">
        {rows.map((r) => (
          <ItemRow key={r.key} r={r} />
        ))}
      </div>
    </Card>
  );
}

export type ActivityTab = { key: string; label: string; rows: ListRowItem[] | null; empty: string; more?: { label: string; href: string } };

export function ActivityTabs({ tabs }: { tabs: ActivityTab[] }) {
  const [tab, setTab] = React.useState(tabs[0]!.key);
  const cur = tabs.find((x) => x.key === tab) ?? tabs[0]!;
  return (
    <section>
      <Tabs value={tab} onChange={setTab} tabs={tabs.map((x) => ({ value: x.key, label: x.label }))} />
      <div className="mt-1 min-h-[220px] divide-y divide-line">
        {cur.rows === null ? (
          <div className="space-y-3 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <span className="size-11 animate-pulse rounded-[14px] bg-surface-3" />
                <span className="h-3 flex-1 animate-pulse rounded bg-surface-3" />
              </div>
            ))}
          </div>
        ) : cur.rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-fg-3">{cur.empty}</div>
        ) : (
          cur.rows.map((r) => <ItemRow key={r.key} r={r} compact />)
        )}
      </div>
      {cur.more && (
        <Link href={cur.more.href} className="mt-1 inline-flex h-10 items-center text-[12.5px] font-semibold text-ember hover:underline">
          {cur.more.label}
        </Link>
      )}
    </section>
  );
}
