"use client";

import * as React from "react";
import Link from "next/link";
import { Button, Card, CardHeader, Chip, Skeleton, WorldMap, cn } from "@kalks/ui";
import { useNewsApi, type CalendarWeek, type Feed, type NewsItem, type NewsMap } from "./api";
import { StoryDialog, useMapPins } from "./news-page";
import { Flag, ago, coverFor, gmt, useNow } from "./shared";

/** Dashboard: latest headlines (pinned first). */
export function LiveNewsCard() {
  const feed = useNewsApi<Feed>("feed?limit=6", 2 * 60_000);
  const [open, setOpen] = React.useState<NewsItem | null>(null);
  const now = useNow(60_000) ?? Date.now();
  const items = [...(feed.data?.pinned ?? []), ...(feed.data?.items ?? [])].slice(0, 4);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Market news"
        action={
          <Link href="/news">
            <Button size="sm" variant="surface">
              All news
            </Button>
          </Link>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {feed.loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[84px] w-full" />)}
        {!feed.loading && items.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">{feed.error ? feed.error.message : "No headlines yet."}</div>}
        {items.map((n) => (
          <button key={n.id} onClick={() => setOpen(n)} className="k-row flex w-full items-start gap-3.5 px-3.5 py-3 text-left transition-colors hover:bg-surface-3/60" data-testid="dashboard-news">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverFor(n)} alt="" className="size-14 shrink-0 rounded-xl object-cover opacity-90" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
                {n.pinned && (
                  <Chip size="sm" tone="ember">
                    Pinned
                  </Chip>
                )}
                <span className="truncate">{n.source.name}</span>·<span className="shrink-0" suppressHydrationWarning>{ago(n.publishedAt, now)}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-snug">{n.title}</div>
              {n.symbols.length > 0 && (
                <div className="mt-1.5 flex gap-1.5">
                  {n.symbols.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      <StoryDialog open={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

/** Dashboard: today's medium and high impact events (server time). */
export function LiveCalendarCard() {
  const cal = useNewsApi<CalendarWeek>("calendar?impact=2,3", 5 * 60_000);
  const now = useNow(30_000);
  const offset = cal.data?.serverOffset ?? 3;
  // today's remaining events; after the last one, the next ones in the week
  const upcoming = (cal.data?.events ?? []).filter((e) => !e.allDay && (now === null || new Date(e.startsAt).getTime() > now - 2 * 3600_000));
  const today = now ? new Date(now + offset * 3600_000).toISOString().slice(0, 10) : null;
  const list = upcoming.slice(0, 5);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Economic calendar"
        subtitle={`Medium and high impact · ${gmt(offset)}`}
        action={
          <Link href="/calendar">
            <Button size="sm" variant="surface">
              View all
            </Button>
          </Link>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {cal.loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[62px] w-full" />)}
        {!cal.loading && list.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">{cal.error ? cal.error.message : "Nothing scheduled for the rest of the week."}</div>}
        {list.map((e) => (
          <Link key={e.id} href="/calendar" className="k-row relative flex items-center gap-3 overflow-hidden py-3 pl-5 pr-4 transition-colors hover:bg-surface-3/60" data-testid="dashboard-calendar">
            <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", e.impact === 3 ? "bg-down" : "bg-warn")} />
            <div className="w-12 shrink-0 font-mono text-[12px] leading-tight text-fg-3">
              {e.serverDate !== today && <div className="text-[10px] uppercase">{new Date(`${e.serverDate}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</div>}
              {e.serverTime}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium">{e.title}</div>
              <div className="k-num mt-0.5 text-[11.5px] text-fg-3">
                {e.actual ? <span className={cn(e.surprise === 1 ? "text-up" : e.surprise === -1 ? "text-down" : "text-fg-2")}>A {e.actual} · </span> : null}F {e.forecast || "—"} · P {e.previous || "—"}
              </div>
            </div>
            <Chip size="sm" tone={e.impact === 3 ? "down" : "neutral"}>
              <Flag country={e.country} className="size-3" />
              {e.currency}
            </Chip>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/** Dashboard: news pins by country with tone heat and the market-session clock. */
export function LiveWorldCard() {
  const map = useNewsApi<NewsMap>("map?hours=24", 5 * 60_000);
  const { pins, heat } = useMapPins(map.data);
  return (
    <Card className="h-full">
      <CardHeader title="Markets & news around the world" subtitle="Headlines by country, last 24 hours" action={<Chip tone="ember">{map.data ? `${map.data.total} stories today` : "Loading"}</Chip>} />
      <div className="px-4 pt-2 sm:px-6">
        <Link href="/news" aria-label="Open market news">
          <WorldMap pins={pins} heat={heat} />
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5 px-6 pb-6 pt-2">
        {pins.slice(0, 8).map((p) => (
          <Link key={p.country} href={`/news`} className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-fg-2 hover:text-fg">
            <Flag country={p.country} className="size-3" />
            {p.label}
            <span className="k-num text-fg-3">{p.count}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

