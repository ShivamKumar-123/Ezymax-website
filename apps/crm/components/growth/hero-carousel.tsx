"use client";

// The dashboard's hero carousel: brand banners and featured events / posts across the top of the page. A "hero"
// slide is a photograph used as a background, with the title and the call to action written over it on a dark
// gradient. A "poster" slide is finished artwork that already carries its own wording - a festival offer drawn in
// Photoshop, say - so it is shown whole at its own shape, with nothing drawn over it and nothing cropped off.
// One slide every 6 s; it pauses
// while the pointer or the keyboard focus is on it, when the reader paused it, and for reduced motion. Swipe on touch,
// arrow keys, dots, and a close button on dismissible slides (hidden for this client afterwards).

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, MapPin, Pause, Play, Video, X } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { buttonVariants, cn } from "@/components/kit";
import type { BannerView } from "./api";
import { hrefOf, isExternal, isOnlineLink, trackPromo, useEventTime } from "./promo";

const ROTATE_MS = 6000;

/** Artwork that speaks for itself: shown entire, never cropped, never written over.
 *
 *  Either the layout says so, or the banner has nothing of its own to write. A hero is a photograph used as a
 *  background, and what makes it a hero is the words over it: a line of copy, a button, usually both. A slide
 *  carrying an image and a title and nothing else is finished artwork - the title repeats what the picture
 *  already says - and that is how a designed poster actually arrives. Treating it as one means such a banner
 *  is never cut to the hero's 4:1 strip, whoever set it up and whichever layout they picked. */
const isPoster = (b: BannerView) => b.layout === "poster" || (!!b.imageUrl && !b.body?.trim() && !b.ctaLabel?.trim() && !hrefOf(b));

/** Until the artwork loads we have to reserve some shape, and most posters are drawn 16:9. */
const POSTER_RATIO = 16 / 9;

/** A tall poster would push the accounts off the screen, so the box stops here and the artwork letterboxes
 *  inside it rather than losing its edges. Set above what a banner-shaped poster needs - 8:3 artwork runs
 *  edge to edge on any realistic dashboard width - so the cap only ever catches something nearly square. */
const POSTER_MAX_H = 600;

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function HeroCarousel({ items, className }: { items: BannerView[]; className?: string }) {
  const t = useT();
  const [hidden, setHidden] = React.useState<Set<BannerView["id"]>>(() => new Set());
  const slides = items.filter((b) => !hidden.has(b.id));
  const [index, setIndex] = React.useState(0);
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const reduced = useReducedMotion();
  const seen = React.useRef<Set<BannerView["id"]>>(new Set());
  // each poster's own width ÷ height, measured when its artwork loads, so the box takes the artwork's shape
  const [ratios, setRatios] = React.useState<Record<string, number>>({});
  const touch = React.useRef<{ x: number; y: number } | null>(null);
  const n = slides.length;
  const i = n ? Math.min(index, n - 1) : 0;
  const current = slides[i];

  const go = React.useCallback((to: number) => setIndex(() => (n ? (to + n) % n : 0)), [n]);

  // one impression per slide the reader actually sees
  React.useEffect(() => {
    if (current && !seen.current.has(current.id)) {
      seen.current.add(current.id);
      trackPromo(current.id, "impression");
    }
  }, [current]);

  const rotating = n > 1 && !hover && !focus && !paused && !reduced;
  React.useEffect(() => {
    if (!rotating) return;
    const id = setTimeout(() => go(i + 1), ROTATE_MS);
    return () => clearTimeout(id);
  }, [rotating, i, go]);

  if (!current) return null;

  // the box follows whichever slide is showing: a poster's own shape, or the 4:1 strip a hero photo is cut to
  const poster = isPoster(current);

  const dismiss = (b: BannerView) => {
    trackPromo(b.id, "dismiss");
    setHidden((s) => new Set(s).add(b.id));
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label={t("updates.hero.label")}
      data-testid="hero-carousel"
      className={cn("group/hero relative isolate overflow-hidden rounded-[24px] border border-line bg-surface-3", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocus(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(document.dir === "rtl" ? i - 1 : i + 1);
        else if (e.key === "ArrowLeft") go(document.dir === "rtl" ? i + 1 : i - 1);
      }}
      onTouchStart={(e) => {
        const p = e.touches[0];
        touch.current = p ? { x: p.clientX, y: p.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const s = touch.current;
        const p = e.changedTouches[0];
        touch.current = null;
        if (!s || !p) return;
        const dx = p.clientX - s.x;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(p.clientY - s.y)) return;
        const forward = document.dir === "rtl" ? dx > 0 : dx < 0;
        go(forward ? i + 1 : i - 1);
      }}
    >
      <div
        className={cn("relative", !poster && "h-[264px] sm:h-auto sm:aspect-[4/1] sm:min-h-[220px]")}
        style={poster ? { aspectRatio: String(ratios[String(current.id)] ?? POSTER_RATIO), maxHeight: POSTER_MAX_H } : undefined}
      >
        {slides.map((b, k) => (
          <Slide
            key={b.id}
            b={b}
            active={k === i}
            label={t("updates.hero.slide", { n: k + 1, total: n })}
            onDismiss={() => dismiss(b)}
            onRatio={(r) => setRatios((x) => (x[String(b.id)] === r ? x : { ...x, [String(b.id)]: r }))}
          />
        ))}
      </div>

      {n > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-1.5">
            {slides.map((b, k) => (
              <button
                key={b.id}
                type="button"
                aria-label={t("updates.hero.slide", { n: k + 1, total: n })}
                aria-current={k === i ? "true" : undefined}
                onClick={() => go(k)}
                className="grid h-6 place-items-center px-0.5"
              >
                <span className={cn("block h-1.5 rounded-full transition-all duration-300", k === i ? "w-6 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70")} />
              </button>
            ))}
            {!reduced && (
              <button
                type="button"
                aria-label={paused ? t("updates.hero.play") : t("updates.hero.pause")}
                onClick={() => setPaused((p) => !p)}
                className="ms-1 grid size-6 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/15 hover:text-white"
              >
                {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label={t("updates.hero.previous")}
            onClick={() => go(i - 1)}
            className="absolute start-3 top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/60 focus-visible:opacity-100 group-hover/hero:opacity-100 sm:grid"
          >
            <ChevronLeft className="size-4 rtl:-scale-x-100" />
          </button>
          <button
            type="button"
            aria-label={t("updates.hero.next")}
            onClick={() => go(i + 1)}
            className="absolute end-3 top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/60 focus-visible:opacity-100 group-hover/hero:opacity-100 sm:grid"
          >
            <ChevronRight className="size-4 rtl:-scale-x-100" />
          </button>
        </>
      )}
    </section>
  );
}

function Slide({ b, active, label, onDismiss, onRatio }: { b: BannerView; active: boolean; label: string; onDismiss: () => void; onRatio: (ratio: number) => void }) {
  const t = useT();
  const poster = isPoster(b);
  const when = useEventTime();
  const href = hrefOf(b);
  const event = b.kind === "event" && b.eventStartsAt;
  const cta = b.ctaLabel || (b.kind === "event" || b.kind === "post" ? t("updates.readMore") : null);
  // the whole slide is the link: the button is its look (no button inside a link)
  const button = cta && href && (
    <span className={cn(buttonVariants({ size: "sm", variant: b.tone === "gold" ? "gold" : b.tone === "neutral" ? "surface" : "ember" }), "pointer-events-none")}>
      {cta} <ArrowUpRight className="rtl:-scale-x-100" />
    </span>
  );
  // a poster carries its own wording inside the artwork, so writing the title over it would say everything twice
  const copy = poster ? (
    <span className="block h-full" />
  ) : (
    <div className="flex h-full max-w-[min(640px,90%)] flex-col justify-end gap-2 px-5 pb-11 pt-6 text-white *:shrink-0 sm:max-w-[60%] sm:justify-center sm:px-9 sm:pb-8">
      {event && (
        <span className="flex min-w-0 items-center gap-x-3 text-[11.5px] font-medium text-white/80">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">{when(b.eventStartsAt, b.eventEndsAt)}</span>
          </span>
          {b.location && (
            <span className="hidden min-w-0 items-center gap-1.5 sm:inline-flex">
              {isOnlineLink(b.location) ? <Video className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
              <span className="truncate">{isOnlineLink(b.location) ? t("updates.online") : b.location}</span>
            </span>
          )}
        </span>
      )}
      <h2 className="k-display line-clamp-2 text-[22px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[28px] xl:text-[32px]">{b.title}</h2>
      {b.body && <p className="line-clamp-2 max-w-[520px] text-[13px] leading-snug text-white/80 sm:text-[14.5px]">{b.body}</p>}
      {button && <div className="mt-1.5">{button}</div>}
    </div>
  );
  const onClick = () => trackPromo(b.id, "click");
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={!active}
      inert={!active}
      data-testid="hero-slide"
      className={cn("absolute inset-0 transition-opacity duration-700 ease-out", active ? "z-[1] opacity-100" : "pointer-events-none opacity-0")}
    >
      {b.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.imageUrl}
          // the link below names a poster; without one the artwork is the only thing here, so it carries the name
          alt={poster && !href ? b.title : ""}
          onLoad={
            poster
              ? (e) => {
                  const el = e.currentTarget;
                  if (el.naturalWidth && el.naturalHeight) onRatio(el.naturalWidth / el.naturalHeight);
                }
              : undefined
          }
          className={cn("absolute inset-0 -z-10 size-full", poster ? "k-poster-in object-contain" : "object-cover")}
          loading={active ? "eager" : "lazy"}
        />
      ) : (
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-ember/60 via-surface-3 to-bg" />
      )}
      {/* glossy artwork catches the light; it passes every so often rather than forever, so it reads as a
          highlight and not as a loading bar */}
      {poster && b.imageUrl && (
        <span
          aria-hidden
          className="k-poster-sheen pointer-events-none absolute inset-y-0 -left-1/4 -z-10 w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
      )}
      {/* the gradient exists to make overlaid words readable; a poster has none, so darkening it only dulls the art */}
      {!poster && (
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/10 sm:bg-gradient-to-r sm:from-black/80 sm:via-black/45 sm:to-transparent rtl:sm:bg-gradient-to-l" />
      )}
      {href ? (
        isExternal(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label={poster ? b.title : undefined} className="block h-full outline-none" data-testid="hero-link">
            {copy}
          </a>
        ) : (
          <Link href={href} onClick={onClick} aria-label={poster ? b.title : undefined} className="block h-full outline-none" data-testid="hero-link">
            {copy}
          </Link>
        )
      ) : (
        copy
      )}
      {b.dismissible && (
        <button
          type="button"
          aria-label={t("updates.hero.dismiss")}
          data-testid="hero-dismiss"
          onClick={onDismiss}
          className="absolute end-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/40 text-white/85 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
