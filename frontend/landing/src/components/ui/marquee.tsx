"use client";

import { animated, easings, useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";

interface MarqueeRowProps {
  items: readonly string[];
  hidden?: boolean;
  rowRef?: React.Ref<HTMLSpanElement>;
}

const MarqueeRow = ({ items, hidden = false, rowRef }: MarqueeRowProps) => (
  <span
    ref={rowRef}
    aria-hidden={hidden || undefined}
    className="flex w-max shrink-0 items-center"
  >
    {items.map((item) => (
      <span key={item} className="flex items-center">
        <span className="whitespace-nowrap">{item}</span>
        <span
          aria-hidden
          className="mx-6 size-1.5 shrink-0 rounded-pill bg-accent"
        />
      </span>
    ))}
  </span>
);

export interface MarqueeProps {
  /** Phrases that crawl by, separated by lime dots. */
  items: readonly string[];
  /** Gate the crawl (e.g. behind the intro `ready` flag). */
  enabled?: boolean;
  /** Crawl speed in px/s. */
  speed?: number;
  className?: string;
}

/**
 * Continuously running ticker crawl. The row renders twice and a
 * linear-timed spring translates exactly one copy's width before looping, so
 * the seam is invisible and the speed stays constant across widths (no CSS
 * keyframes — ADR-0002). Under prefers-reduced-motion it renders a static
 * wrapped paragraph instead.
 */
export const Marquee = ({
  items,
  enabled = true,
  speed = 70,
  className,
}: MarqueeProps) => {
  const rowRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(false);

  const [crawl, api] = useSpring(() => ({ x: 0 }));

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setWidth(row.scrollWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!enabled || reduced || width <= 0) return;
    api.start({
      from: { x: 0 },
      to: { x: -width },
      loop: true,
      config: { duration: (width / speed) * 1000, easing: easings.linear },
    });
    return () => {
      api.stop();
    };
  }, [api, enabled, reduced, width, speed]);

  if (reduced) {
    return <p className={className}>{items.join(" · ")}</p>;
  }

  return (
    <div
      className={`overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] ${className ?? ""}`}
    >
      <p className="sr-only">{items.join(" ")}</p>
      <animated.div
        aria-hidden
        style={{ transform: crawl.x.to((x) => `translate3d(${x}px,0,0)`) }}
        className="flex w-max"
      >
        <MarqueeRow items={items} rowRef={rowRef} />
        <MarqueeRow items={items} hidden />
      </animated.div>
    </div>
  );
};
