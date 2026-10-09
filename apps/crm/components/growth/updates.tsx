"use client";

// Events & updates: brand events and posts from the growth service (GET /api/growth/posts), targeted at the client.
// The dashboard section (the next few, newest / soonest first), the "All updates" page (/updates) and the page of one
// event or post (/updates/[id]) with its markdown body rendered as text. Module `promotions`.

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clock, MapPin, Megaphone, Newspaper, Video } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { Button, Card, Chip, EmptyState, PageHeader, Reveal, Segmented, Skeleton, buttonVariants, cn } from "@/components/kit";
import { LoadError } from "./ui";
import { SectionTitle } from "@/components/dashboard/home/overview";
import { useModule } from "@/components/tenant-config";
import type { BannerView } from "./api";
import { DateBadge, PostBody, isExternal, isOnlineLink, trackPromo, useEventTime, usePost, usePosts, usePublished, useStateLabel } from "./promo";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function UpdateCard({ p, className }: { p: BannerView; className?: string }) {
  const t = useT();
  const when = useEventTime();
  const published = usePublished();
  const stateLabel = useStateLabel();
  const event = p.kind === "event";
  const seen = React.useRef(false);
  React.useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    trackPromo(p.id, "impression");
  }, [p.id]);
  const state = event ? stateLabel(p.eventState) : null;
  return (
    <Link
      href={`/updates/${p.id}`}
      onClick={() => trackPromo(p.id, "click")}
      data-testid="update-card"
      className={cn("k-card group flex h-full flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-0.5", className)}
    >
      <div className="relative aspect-video overflow-hidden bg-surface-3">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <span aria-hidden className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ember/30 via-surface-3 to-surface-2 text-fg-3">
            {event ? <CalendarDays className="size-7" /> : <Newspaper className="size-7" />}
          </span>
        )}
        {event && p.eventStartsAt && <DateBadge iso={p.eventStartsAt} className="absolute start-3 top-3" />}
        <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {event ? <CalendarDays className="size-3" /> : <Megaphone className="size-3" />}
          {event ? t("updates.kind.event") : t("updates.kind.post")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        {state && (
          <Chip size="sm" tone={p.eventState === "live" ? "up" : p.eventState === "ended" ? "neutral" : "ember"} dot className="w-fit">
            {state}
          </Chip>
        )}
        <h3 className="line-clamp-2 text-[15.5px] font-medium leading-snug tracking-tight text-fg">{p.title}</h3>
        {event && p.eventStartsAt ? (
          <div className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{when(p.eventStartsAt, p.eventEndsAt)}</span>
          </div>
        ) : (
          p.publishedAt && <div className="text-[12.5px] text-fg-3">{published(p.publishedAt)}</div>
        )}
        {p.body && <p className="line-clamp-2 text-[13px] leading-snug text-fg-2">{p.body}</p>}
        {event && p.location && (
          <div className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
            {isOnlineLink(p.location) ? <Video className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
            <span className="truncate">{isOnlineLink(p.location) ? t("updates.online") : p.location}</span>
          </div>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px] font-medium text-ember">
          {t("updates.readMore")} <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100" />
        </span>
      </div>
    </Link>
  );
}

const COLS: Record<number, string> = { 1: "sm:max-w-md", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" };

/* ------------------------------------------------------------------ */
/* Dashboard section                                                    */
/* ------------------------------------------------------------------ */

/** "Events & updates" on the dashboard: the next four (nothing when there are none or the module is off). */
export function UpdatesSection() {
  const t = useT();
  const on = useModule("promotions");
  const { data } = usePosts({ limit: 4 });
  const items = on ? (data?.items ?? []) : [];
  if (items.length === 0) return null;
  return (
    <section data-testid="updates-section">
      <SectionTitle
        action={
          <Link href="/updates" className={buttonVariants({ variant: "surface", size: "sm" })}>
            {t("updates.all")} <ArrowUpRight className="rtl:-scale-x-100" />
          </Link>
        }
      >
        {t("updates.title")}
      </SectionTitle>
      <div className={cn("grid grid-cols-1 gap-5", COLS[Math.min(items.length, 4)])}>
        {items.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <UpdateCard p={p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* /updates                                                             */
/* ------------------------------------------------------------------ */

type Filter = "all" | "event" | "post";
const PAGE = 12;

export function UpdatesPage() {
  const t = useT();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [pages, setPages] = React.useState(1);
  const { data, error, loading, reload } = usePosts({ kind: filter === "all" ? null : filter, limit: PAGE * pages });
  const items = data?.items ?? [];
  const more = data ? data.total > items.length : false;
  return (
    <div className="pb-16">
      <PageHeader
        title={t("updates.title")}
        subtitle={t("updates.subtitle")}
        actions={
          <Segmented
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPages(1);
            }}
            options={[
              { value: "all", label: t("common.all") },
              { value: "event", label: t("updates.filter.events") },
              { value: "post", label: t("updates.filter.posts") },
            ]}
          />
        }
      />
      {error && !data ? (
        <LoadError error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[340px] w-full rounded-[22px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState illustration="speech_balloon" title={t("updates.empty.title")} text={t("updates.empty.text")} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" data-testid="updates-list">
            {items.map((p, i) => (
              <Reveal key={p.id} delay={Math.min(i, 8) * 0.04}>
                <UpdateCard p={p} />
              </Reveal>
            ))}
          </div>
          {more && (
            <div className="mt-6 flex justify-center">
              <Button variant="surface" onClick={() => setPages((n) => n + 1)} disabled={loading}>
                {t("common.showMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* /updates/[id]                                                        */
/* ------------------------------------------------------------------ */

export function UpdateDetail({ id }: { id: string }) {
  const t = useT();
  const when = useEventTime();
  const published = usePublished();
  const stateLabel = useStateLabel();
  const { post, missing, error, loading, reload } = usePost(id);
  const back = (
    <Link href="/updates" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-2 transition-colors hover:text-fg">
      <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t("updates.all")}
    </Link>
  );
  if (missing) {
    return (
      <div className="pb-16">
        {back}
        <Card>
          <EmptyState
            illustration="speech_balloon"
            title={t("updates.notFound.title")}
            text={t("updates.notFound.text")}
            action={
              <Link href="/updates" className={buttonVariants({ variant: "surface" })}>
                {t("updates.all")}
              </Link>
            }
          />
        </Card>
      </div>
    );
  }
  if (error && !post) {
    return (
      <div className="pb-16">
        {back}
        <LoadError error={error} onRetry={reload} />
      </div>
    );
  }
  if (!post || loading) {
    return (
      <div className="pb-16">
        {back}
        <Skeleton className="aspect-[21/9] w-full rounded-[24px]" />
        <Skeleton className="mt-6 h-9 w-2/3" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  const event = post.kind === "event";
  const state = event ? stateLabel(post.eventState) : null;
  const online = isOnlineLink(post.location);
  const cta = post.ctaUrl ? (
    isExternal(post.ctaUrl) ? (
      <a href={post.ctaUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackPromo(post.id, "click")} className={buttonVariants({ variant: "ember" })} data-testid="update-cta">
        {post.ctaLabel || t("common.learnMore")} <ArrowUpRight className="rtl:-scale-x-100" />
      </a>
    ) : (
      <Link href={post.ctaUrl} onClick={() => trackPromo(post.id, "click")} className={buttonVariants({ variant: "ember" })} data-testid="update-cta">
        {post.ctaLabel || t("common.learnMore")} <ArrowUpRight className="rtl:-scale-x-100" />
      </Link>
    )
  ) : null;

  return (
    <article className="mx-auto max-w-[920px] pb-16" data-testid="update-detail">
      {back}
      {post.imageUrl && (
        <Reveal>
          <div className="relative aspect-[16/9] overflow-hidden rounded-[24px] border border-line bg-surface-3 sm:aspect-[21/9]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
          </div>
        </Reveal>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Chip size="sm" tone={event ? "ember" : "neutral"}>
          {event ? <CalendarDays className="size-3" /> : <Megaphone className="size-3" />}
          {event ? t("updates.kind.event") : t("updates.kind.post")}
        </Chip>
        {state && (
          <Chip size="sm" dot tone={post.eventState === "live" ? "up" : post.eventState === "ended" ? "neutral" : "info"}>
            {state}
          </Chip>
        )}
        {post.publishedAt && <span className="text-[12.5px] text-fg-3">{t("updates.published", { date: published(post.publishedAt) })}</span>}
      </div>
      <h1 className="k-display mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-fg sm:text-[36px]">{post.title}</h1>
      {post.body && <p className="mt-3 text-[16.5px] leading-relaxed text-fg-2">{post.body}</p>}

      {event && (
        <Card className="mt-6">
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember-soft text-ember">
                <CalendarDays className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{t("updates.when")}</div>
                <div className="mt-0.5 text-[14px] font-medium text-fg">{when(post.eventStartsAt, post.eventEndsAt)}</div>
              </div>
            </div>
            {post.location && (
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info">{online ? <Video className="size-5" /> : <MapPin className="size-5" />}</span>
                <div className="min-w-0">
                  <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{t("updates.where")}</div>
                  <div className="mt-0.5 truncate text-[14px] font-medium text-fg">{online ? t("updates.online") : post.location}</div>
                </div>
              </div>
            )}
            {online && post.eventState !== "ended" && (
              <a href={post.location!} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "surface" })} data-testid="update-join">
                <Video /> {t("updates.join")}
              </a>
            )}
          </div>
        </Card>
      )}

      {post.content.trim() && (
        <Reveal delay={0.05}>
          <PostBody src={post.content} className="mt-8" />
        </Reveal>
      )}
      {cta && <div className="mt-8">{cta}</div>}
    </article>
  );
}
