"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useRef } from "react";

import { ProgressTrigger } from "@/components/animation/springs/progress-trigger";
import { Check } from "@/components/ui/icons";
import type { tickerBand } from "@/data/mocks/home";

export interface TickerBandProps {
  content: typeof tickerBand;
}

type Segment = (typeof tickerBand)["segments"][number];

/** Inline lime connector — punctuation between words, not a section divider. */
const TickerCurve = () => (
  <svg
    viewBox="0 0 64 40"
    fill="none"
    stroke="var(--accent)"
    strokeWidth={3}
    strokeLinecap="round"
    aria-hidden
    className="h-[0.55em] w-[0.9em] shrink-0"
  >
    <path d="M3 30C18 4 30 38 44 14c6-10 12-8 17-2" />
  </svg>
);

const SegmentItem = ({ segment }: { segment: Segment }) => {
  switch (segment.type) {
    case "em":
      return (
        <em className="bg-[linear-gradient(90deg,var(--accent),var(--foreground))] bg-clip-text pr-[0.06em] text-transparent">
          {segment.value}
        </em>
      );
    case "curve":
      return <TickerCurve />;
    case "check":
      return <Check className="text-[0.4em] text-accent-positive" />;
    case "tag":
      return (
        <span className="inline-flex items-center gap-2.5 rounded-pill border border-line bg-glass px-6 py-3.5 font-mono text-sm leading-none font-bold tracking-label text-foreground/80 uppercase not-italic backdrop-blur-glass">
          <span className="size-2 rounded-pill bg-accent" />
          {segment.value}
        </span>
      );
    case "chip":
      return (
        <span className="inline-flex items-center gap-3 rounded-card-sm border border-line bg-glass px-7 py-4 text-2xl leading-none font-bold tracking-normal tabular-nums backdrop-blur-glass">
          <span className="size-3 rounded-pill bg-accent-positive" />
          {segment.value}
        </span>
      );
    default:
      return <span>{segment.value}</span>;
  }
};

/**
 * Horizontal ticker-tape statement band: one continuous sentence that glides
 * sideways as the visitor scrolls through the section — the codebase's
 * spring-based equivalent of the GSAP-ScrollTrigger reference (ADR-0002 bans
 * GSAP/keyframes). The tall section pins a full-height viewport; scroll
 * progress 0→1 maps to the strip's overflow width, smoothed by a spring.
 */
export const TickerBand = ({ content }: TickerBandProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const distanceRef = useRef(0);

  const [flow, api] = useSpring(() => ({
    x: 0,
    progress: 0,
    config: { tension: 120, friction: 28 },
  }));

  useEffect(() => {
    const viewport = viewportRef.current;
    const strip = stripRef.current;
    if (!viewport || !strip) return;

    const measure = () => {
      distanceRef.current = Math.max(
        0,
        strip.scrollWidth - viewport.clientWidth,
      );
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  const onProgress = ({ progress }: { progress: number }) => {
    api.start({ x: -progress * distanceRef.current, progress });
  };

  return (
    <ProgressTrigger
      tag="section"
      id="ticker"
      aria-label={content.label}
      start="top top"
      end="bottom bottom"
      frameInterval={15}
      onChange={onProgress}
      className="relative z-10 h-[280lvh]"
    >
      <p className="sr-only">{content.sentence}</p>

      <div
        aria-hidden
        className="sticky top-0 flex h-lvh flex-col justify-center gap-12"
      >
        <div
          ref={viewportRef}
          className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <animated.div
            ref={stripRef}
            style={{
              transform: flow.x.to((x) => `translate3d(${x}px,0,0)`),
            }}
            className="flex w-max items-center gap-[0.4em] px-[12vw] py-[0.2em] text-7xl leading-display font-bold tracking-display whitespace-nowrap sm:text-8xl lg:text-9xl"
          >
            {content.segments.map((segment, index) => (
              <SegmentItem key={index} segment={segment} />
            ))}
          </animated.div>
        </div>

        <div className="flex items-center justify-center gap-5">
          <span className="font-mono text-sm font-bold tracking-label text-foreground/60 uppercase">
            {content.hint}
          </span>
          <span className="h-1 w-56 overflow-hidden rounded-pill bg-line">
            <animated.span
              style={{
                transform: flow.progress.to((p) => `scaleX(${p})`),
              }}
              className="block h-full w-full origin-left bg-accent"
            />
          </span>
        </div>
      </div>
    </ProgressTrigger>
  );
};
