"use client";

// Avatar (pastel initials tile from the name) and the margin gauge, with colours from the design tokens so a broker's
// brand colour drives them (the @kalks/ui gauge carries fixed Kalks ember stops).

import * as React from "react";
import { motion } from "motion/react";
import { Money as UiMoney, cn } from "@kalks/ui";

const AVATAR_TONES = ["accent", "lavender", "pink", "amber", "mint", "sky", "coral"] as const;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ src, name, size = 36, verified, online, className }: { src?: string; name: string; size?: number; verified?: boolean; online?: boolean; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tone = AVATAR_TONES[hash(name) % AVATAR_TONES.length];
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        <span className={cn("k-tile size-full rounded-full font-bold", `k-tile-${tone}`)} style={{ fontSize: Math.max(10, Math.round(size * 0.34)) }}>
          {initials}
        </span>
      )}
      {verified && (
        <span className="absolute -bottom-0.5 -end-0.5 grid size-4 place-items-center rounded-full bg-up ring-2 ring-surface">
          <svg viewBox="0 0 12 12" className="size-2.5 fill-none stroke-white stroke-2">
            <path d="M2.5 6.2l2.2 2.2 4.8-4.8" />
          </svg>
        </span>
      )}
      {online && <span className="absolute bottom-0 end-0 size-2.5 rounded-full bg-up ring-2 ring-surface" />}
    </span>
  );
}

/** Margin-level / sentiment ring in the brand colour. */
export function Gauge({ value, max = 100, label, sublabel, display, size = 240, className }: { value: number; max?: number; label?: string; sublabel?: React.ReactNode; display?: React.ReactNode; size?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  const stroke = size * 0.075;
  const r = (size - stroke) / 2 - 8;
  const c = 2 * Math.PI * r;
  const arc = 0.78;
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 rotate-[129.6deg]">
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--k-ember) 55%, #fff)" }} />
            <stop offset="1" style={{ stopColor: "var(--k-ember)" }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--k-surface-3)" strokeWidth={stroke} strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
        {pct > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#g${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: `${c * arc * pct} ${c}` }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </svg>
      <div className="absolute rounded-full bg-surface shadow-[var(--k-shadow-card)]" style={{ inset: stroke + 18 }} />
      <div className="relative flex flex-col items-center text-center">
        <div className="k-num k-display font-bold leading-none tracking-tight text-fg" style={{ fontSize: size * 0.17 }}>
          {display ?? Math.round(value)}
        </div>
        {label && <div className="mt-2 text-sm text-fg-2">{label}</div>}
        {sublabel && <div className="mt-1 text-xs">{sublabel}</div>}
      </div>
    </div>
  );
}

/** Big number with softly dimmed decimals (less dim than the Kalks default, as in the pastel dashboard). */
export function Money(props: React.ComponentProps<typeof UiMoney>) {
  return <UiMoney {...props} decClassName={cn("opacity-60", props.decClassName)} />;
}
