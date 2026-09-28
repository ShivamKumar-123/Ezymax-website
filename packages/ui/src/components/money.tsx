"use client";

import * as React from "react";
import { animate, useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import { cn } from "../lib/cn";
import { splitNumber, formatPct } from "../lib/format";

/**
 * Big number with dimmed decimals ($54,208.<dim>11</dim>) and an optional
 * count-up on first view — the signature Kalks number treatment.
 */
export function Money({
  value,
  currency = "$",
  decimals = 2,
  countUp = true,
  signed = false,
  tone,
  className,
  decClassName,
}: {
  value: number;
  currency?: string;
  decimals?: number;
  countUp?: boolean;
  signed?: boolean;
  tone?: "up" | "down" | "auto";
  className?: string;
  decClassName?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(countUp ? value * 0.94 : value);
  const [display, setDisplay] = React.useState(countUp ? value * 0.94 : value);

  useMotionValueEvent(mv, "change", (v) => setDisplay(v));
  React.useEffect(() => {
    if (!countUp) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const c = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, inView, countUp, mv]);

  const { sign, int, dec } = splitNumber(display, decimals);
  const t = tone === "auto" ? (value > 0 ? "up" : value < 0 ? "down" : undefined) : tone;
  return (
    <span ref={ref} className={cn("k-num whitespace-nowrap", t === "up" && "text-up", t === "down" && "text-down", className)}>
      {signed && value > 0 ? "+" : sign}
      {currency}
      {int}
      {decimals > 0 && <span className={cn("opacity-40", decClassName)}>.{dec}</span>}
    </span>
  );
}

export function Delta({ value, suffix = "%", decimals = 2, className, chip }: { value: number; suffix?: string; decimals?: number; className?: string; chip?: boolean }) {
  const up = value >= 0;
  const text = suffix === "%" ? formatPct(value, decimals) : `${up ? "+" : "-"}${Math.abs(value).toFixed(decimals)}${suffix}`;
  return (
    <span
      className={cn(
        "k-num inline-flex items-center gap-1 font-medium",
        up ? "text-up" : "text-down",
        chip && (up ? "rounded-full bg-up-soft px-2 py-0.5 text-[11.5px]" : "rounded-full bg-down-soft px-2 py-0.5 text-[11.5px]"),
        className,
      )}
    >
      <svg viewBox="0 0 10 10" className={cn("size-2 fill-current", !up && "rotate-180")}>
        <path d="M5 1l4 7H1z" />
      </svg>
      {text.replace(/^[+-]/, "")}
    </span>
  );
}
