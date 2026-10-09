"use client";

// Brand promotions (services/growth banners of kind banner / event / post): the data hooks of the dashboard's hero
// carousel and Events & updates (demo builds read @ezymex/mock/promotions), event dates in the reader's time zone, the
// date badge and the post body (the Academy's markdown subset as React elements, never HTML).

import * as React from "react";
import { IS_DEMO } from "@ezymex/mock/mode";
import { PROMO_HERO, PROMO_UPDATES, promoById } from "@ezymex/mock/promotions";
import { intlTag } from "@ezymex/i18n/locales";
import { useFormat, useT } from "@ezymex/i18n/react";
import { cn } from "@/components/kit";
import { Inline, parseBlocks } from "@/components/academy/live/markdown";
import { GrowthApiError, growthApi, useGrowth, type BannerView, type PostView, type PostsPage } from "./api";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

/** Counts an impression / click / dismissal (one per client per item per day on the service). Live builds only. */
export function trackPromo(id: BannerView["id"], kind: "impression" | "click" | "dismiss") {
  if (IS_DEMO) return;
  growthApi(`banners/${id}/events`, { body: { kind } }).catch(() => {});
}

export const isExternal = (url: string) => /^https?:\/\//i.test(url);
export const isOnlineLink = (s: string | null | undefined) => !!s && /^https:\/\//i.test(s.trim());

/** Where an item opens: its button link, else (events and posts) its page. */
export function hrefOf(b: BannerView): string | null {
  if (b.ctaUrl) return b.ctaUrl;
  return b.kind === "event" || b.kind === "post" ? `/updates/${b.id}` : null;
}

/** The dashboard's banner slot items, split into the hero carousel and the card banners. */
export function useDashboardBanners(): { hero: BannerView[]; cards: BannerView[]; loading: boolean } {
  const live = useGrowth<{ items: BannerView[] }>(IS_DEMO ? null : "banners?placement=dashboard");
  if (IS_DEMO) return { hero: PROMO_HERO, cards: [], loading: false };
  const items = live.data?.items ?? [];
  return { hero: items.filter((b) => b.layout === "hero"), cards: items.filter((b) => b.layout !== "hero"), loading: live.loading };
}

/** Events & updates (`posts?kind=&page=&limit=`). */
export function usePosts(query: { kind?: "event" | "post" | null; page?: number; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (query.kind) q.set("kind", query.kind);
  if (query.page && query.page > 1) q.set("page", String(query.page));
  q.set("limit", String(query.limit ?? 20));
  const live = useGrowth<PostsPage>(IS_DEMO ? null : `posts?${q}`);
  return React.useMemo(() => {
    if (!IS_DEMO) return live;
    const all = PROMO_UPDATES.filter((p) => !query.kind || p.kind === query.kind);
    const limit = query.limit ?? 20;
    const page = query.page ?? 1;
    const data: PostsPage = { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit };
    return { ...live, data, error: null, loading: false };
  }, [live, query.kind, query.page, query.limit]);
}

/** One event / post page. `missing` = not found, ended or not meant for this client. */
export function usePost(id: string) {
  const ok = /^\d{1,18}$/.test(id);
  const live = useGrowth<{ post: PostView }>(IS_DEMO || !ok ? null : `posts/${id}`);
  if (IS_DEMO || !ok) {
    const p = ok ? promoById(id) : null;
    const post = p && p.kind !== "banner" ? ({ ...p, content: p.content ?? "" } as PostView) : null;
    return { post, missing: !post, error: null as GrowthApiError | null, loading: false, reload: live.reload };
  }
  const missing = live.error?.status === 404;
  return { post: live.data?.post ?? null, missing, error: missing ? null : live.error, loading: live.loading, reload: live.reload };
}

/* ------------------------------------------------------------------ */
/* Dates                                                                */
/* ------------------------------------------------------------------ */

/** Event times in the reader's language and time zone: "Thu 12 Nov, 18:30 – 21:30 GST". */
export function useEventTime() {
  const { locale } = useFormat();
  return React.useCallback(
    (start: string | null | undefined, end?: string | null) => {
      if (!start) return "";
      const tag = intlTag(locale);
      const s = new Date(start);
      if (Number.isNaN(s.getTime())) return "";
      const full: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
      const tz = new Intl.DateTimeFormat(tag, { timeZoneName: "short" }).formatToParts(s).find((p) => p.type === "timeZoneName")?.value ?? "";
      const a = new Intl.DateTimeFormat(tag, full).format(s);
      if (!end) return `${a} ${tz}`.trim();
      const e = new Date(end);
      if (Number.isNaN(e.getTime())) return `${a} ${tz}`.trim();
      const b = new Intl.DateTimeFormat(tag, s.toDateString() === e.toDateString() ? { hour: "2-digit", minute: "2-digit" } : full).format(e);
      return `${a} – ${b} ${tz}`.trim();
    },
    [locale],
  );
}

/** The publish date of a post: "12 Nov 2026". */
export function usePublished() {
  const { locale } = useFormat();
  return React.useCallback((iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : ""), [locale]);
}

/** Month + day of an event, on its image. */
export function DateBadge({ iso, className }: { iso: string; className?: string }) {
  const { locale } = useFormat();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tag = intlTag(locale);
  return (
    <span className={cn("flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-[10px] border border-white/15 bg-black/55 text-white shadow-sm backdrop-blur", className)}>
      <span className="w-full bg-ember py-0.5 text-center text-[9.5px] font-semibold uppercase tracking-[0.08em] text-white">{new Intl.DateTimeFormat(tag, { month: "short" }).format(d)}</span>
      <span className="k-num py-1 text-[17px] font-semibold leading-none">{new Intl.DateTimeFormat(tag, { day: "numeric" }).format(d)}</span>
    </span>
  );
}

/** "Upcoming" / "Happening now" / "Ended". */
export function useStateLabel() {
  const t = useT();
  return (s: BannerView["eventState"]) => (s === "live" ? t("updates.state.live") : s === "ended" ? t("updates.state.ended") : s === "upcoming" ? t("updates.state.upcoming") : null);
}

/* ------------------------------------------------------------------ */
/* Post body                                                            */
/* ------------------------------------------------------------------ */

const HTTPS_LINK = /(\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;

/** Inline markdown with https:// links (new tab); the rest as the Academy renders it (internal links, bold, code). */
function PostInline({ text }: { text: string }) {
  return (
    <>
      {text.split(HTTPS_LINK).map((part, i) => {
        const m = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
        return m ? (
          <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer nofollow" className="text-ember underline decoration-ember/40 underline-offset-2 hover:decoration-ember">
            {m[1]}
          </a>
        ) : (
          <Inline key={i} text={part} />
        );
      })}
    </>
  );
}

/** The markdown body of an event / post: headings, paragraphs, lists, notes, tables, code; no HTML, no images. */
export function PostBody({ src, className }: { src: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(src), [src]);
  return (
    <div className={cn("text-[15.5px] leading-[1.75] text-fg-2", className)} data-testid="post-body">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return b.level === 2 ? (
              <h2 key={i} className="mb-3 mt-9 text-[21px] font-medium leading-snug tracking-tight text-fg first:mt-0">
                <PostInline text={b.text} />
              </h2>
            ) : (
              <h3 key={i} className="mb-2 mt-7 text-[17px] font-medium tracking-tight text-fg first:mt-0">
                <PostInline text={b.text} />
              </h3>
            );
          case "p":
            return (
              <p key={i} className="my-4 first:mt-0">
                <PostInline text={b.text} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="my-4 space-y-2 ps-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-ember/80" />
                    <span className="min-w-0">
                      <PostInline text={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="my-4 space-y-2 ps-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="k-num mt-[3px] grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[11.5px] font-medium text-fg-2">{b.start + j}</span>
                    <span className="min-w-0">
                      <PostInline text={it} />
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "quote": {
            const m = /^\*\*([^*:]+):?\*\*:?\s*(.*)$/.exec(b.text);
            return (
              <aside key={i} role="note" className="my-5 rounded-[14px] border border-ember/25 bg-ember-soft px-4 py-3.5 text-[14.5px] leading-relaxed text-fg-2">
                {m && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ember">{m[1]!.trim()}</div>}
                <PostInline text={m ? m[2]! : b.text} />
              </aside>
            );
          }
          case "code":
            return (
              <pre key={i} className="my-5 overflow-x-auto rounded-[14px] border border-line bg-surface-2 px-4 py-3.5 font-mono text-[13px] leading-relaxed text-fg">
                {b.text}
              </pre>
            );
          case "table":
            return (
              <div key={i} className="my-5 overflow-x-auto rounded-[14px] border border-line">
                <table className="w-full min-w-[420px] border-collapse text-[13.5px]">
                  <thead>
                    <tr className="bg-surface-2">
                      {b.head.map((c, j) => (
                        <th key={j} className="border-b border-line px-3.5 py-2.5 text-start text-[12px] font-medium uppercase tracking-wider text-fg-3">
                          <PostInline text={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-line last:border-0">
                        {r.map((c, x) => (
                          <td key={x} className={cn("px-3.5 py-2.5 align-top", x === 0 ? "text-fg" : "text-fg-2")}>
                            <PostInline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className="my-8 border-line" />;
        }
      })}
    </div>
  );
}
