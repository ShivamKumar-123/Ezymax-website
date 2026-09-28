"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "../lib/cn";

/**
 * Card with a soft radial spotlight that follows the cursor
 * (React Bits "SpotlightCard" pattern, tuned to the ember palette).
 */
export function SpotlightCard({
  className,
  children,
  color = "rgba(255, 110, 50, 0.10)",
  hot,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { color?: string; hot?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x: 0, y: 0, o: 0 });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top, o: 1 });
      }}
      onMouseLeave={() => setPos((p) => ({ ...p, o: 0 }))}
      className={cn(hot ? "k-hot-card relative rounded-[20px]" : "k-card", "overflow-hidden transition-[border-color] duration-300 hover:border-[var(--k-border-top)]", className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: pos.o, background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 60%)` }}
      />
      {children}
    </div>
  );
}

/**
 * Formerly drifting star particles on hero cards. Removed by design direction (no moving decoration on
 * cards); kept as a no-op so existing call sites stay valid.
 */
export function Starfield(_props: { density?: number; className?: string }) {
  return null;
}

/** Fade-up container for page sections. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
